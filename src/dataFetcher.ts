/**
 * Data Fetcher Module
 * 
 * Handles fetching weather data from Windy API for air density calculations.
 * Uses getPointForecastData to get temperature, pressure, and humidity.
 */

import { getPointForecastData } from '@windy/fetch';
import store from '@windy/store';
import { calculateAirDensity } from './airDensity';

import type { LatLon, WeatherDataPayload, DataHash } from '@windy/interfaces.d';
import type { HttpPayload } from '@windy/http.d';
import type { DensityDataPoint } from './DensityLayer';

// Cache for weather data to avoid repeated API calls
const dataCache = new Map<string, { data: DensityDataPoint; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a cache key for a location
 */
function getCacheKey(lat: number, lon: number): string {
    return `${lat.toFixed(2)}_${lon.toFixed(2)}`;
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < CACHE_TTL;
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
    const now = Date.now();
    dataCache.forEach((value, key) => {
        if (now - value.timestamp >= CACHE_TTL) {
            dataCache.delete(key);
        }
    });
}

/**
 * Clear all cached data
 */
export function clearCache(): void {
    dataCache.clear();
}

/**
 * Get the current weather model from store
 */
export function getCurrentModel(): string {
    return store.get('product') || 'ecmwf';
}

/**
 * Get the current timestamp from store
 */
export function getCurrentTimestamp(): number {
    return store.get('timestamp') || Date.now();
}

/**
 * Fetch weather data for a single point
 */
export async function fetchPointData(
    location: LatLon,
    pluginName: string
): Promise<DensityDataPoint | null> {
    const cacheKey = getCacheKey(location.lat, location.lon);
    
    // Check cache first
    const cached = dataCache.get(cacheKey);
    if (cached && isCacheValid(cached.timestamp)) {
        return cached.data;
    }
    
    try {
        const model = getCurrentModel();
        const response: HttpPayload<WeatherDataPayload<DataHash>> = await getPointForecastData(
            model,
            location,
            pluginName
        );
        
        const { data } = response;
        if (!data || !data.data) {
            return null;
        }
        
        const weatherData = data.data;
        const currentTs = getCurrentTimestamp();
        
        // Find the index for current timestamp (or nearest)
        const timestamps = weatherData.ts || [];
        let timeIndex = 0;
        let minDiff = Infinity;
        
        for (let i = 0; i < timestamps.length; i++) {
            const diff = Math.abs(timestamps[i] - currentTs);
            if (diff < minDiff) {
                minDiff = diff;
                timeIndex = i;
            }
        }
        
        // Extract temperature, pressure, and humidity
        // Note: Windy data format varies by model
        const temp = weatherData.temp?.[timeIndex];  // Temperature in Kelvin or Celsius
        const pressure = weatherData.pressure?.[timeIndex];  // Surface pressure in Pa or hPa
        const rh = weatherData.rh?.[timeIndex];  // Relative humidity in %
        
        if (temp === undefined || pressure === undefined) {
            return null;
        }
        
        // Convert temperature from Kelvin to Celsius if needed (Windy typically uses Kelvin)
        let tempCelsius = temp;
        if (temp > 200) {
            // Likely Kelvin
            tempCelsius = temp - 273.15;
        }
        
        // Convert pressure from Pa to hPa if needed
        let pressureHPa = pressure;
        if (pressure > 10000) {
            // Likely in Pa
            pressureHPa = pressure / 100;
        }
        
        // Use default humidity if not available
        const humidity = rh !== undefined ? rh : 50;
        
        // Calculate density
        const density = calculateAirDensity(tempCelsius, pressureHPa, humidity);
        
        const dataPoint: DensityDataPoint = {
            lat: location.lat,
            lon: location.lon,
            temp: tempCelsius,
            pressure: pressureHPa,
            humidity,
            density
        };
        
        // Cache the result
        dataCache.set(cacheKey, { data: dataPoint, timestamp: Date.now() });
        
        return dataPoint;
    } catch (error) {
        console.error('Error fetching point data:', error);
        return null;
    }
}

/**
 * Generate grid points for a given map bounds
 */
export function generateGridPoints(
    bounds: L.LatLngBounds,
    gridSize: number = 2  // Degrees between points
): LatLon[] {
    const points: LatLon[] = [];
    
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const west = bounds.getWest();
    const east = bounds.getEast();
    
    // Adjust grid size based on bounds size
    const latRange = north - south;
    const lonRange = east - west;
    const avgRange = (latRange + lonRange) / 2;
    
    // Use finer grid for smaller areas
    let actualGridSize = gridSize;
    if (avgRange < 10) {
        actualGridSize = 1;
    } else if (avgRange < 30) {
        actualGridSize = 2;
    } else if (avgRange < 60) {
        actualGridSize = 3;
    } else {
        actualGridSize = 5;
    }
    
    // Limit total points to avoid API overload
    const maxPoints = 50;
    const latSteps = Math.ceil(latRange / actualGridSize);
    const lonSteps = Math.ceil(lonRange / actualGridSize);
    
    // Adjust if too many points
    if (latSteps * lonSteps > maxPoints) {
        actualGridSize = Math.sqrt((latRange * lonRange) / maxPoints);
    }
    
    for (let lat = south; lat <= north; lat += actualGridSize) {
        for (let lon = west; lon <= east; lon += actualGridSize) {
            points.push({ lat, lon });
        }
    }
    
    return points;
}

/**
 * Fetch weather data for multiple points (with rate limiting)
 */
export async function fetchGridData(
    bounds: L.LatLngBounds,
    pluginName: string,
    onProgress?: (progress: number) => void
): Promise<DensityDataPoint[]> {
    const points = generateGridPoints(bounds);
    const results: DensityDataPoint[] = [];
    
    // Process in batches to avoid overwhelming the API
    const batchSize = 5;
    const delayMs = 100;
    
    for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        
        // Fetch batch in parallel
        const batchPromises = batch.map(point => fetchPointData(point, pluginName));
        const batchResults = await Promise.all(batchPromises);
        
        // Add successful results
        batchResults.forEach(result => {
            if (result) {
                results.push(result);
            }
        });
        
        // Report progress
        if (onProgress) {
            onProgress(Math.min(100, Math.round((i + batch.length) / points.length * 100)));
        }
        
        // Small delay between batches
        if (i + batchSize < points.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    return results;
}

/**
 * Subscribe to store changes for automatic data refresh
 */
export function subscribeToStoreChanges(
    callback: () => void
): () => void {
    const unsubscribers: (() => void)[] = [];
    
    // Subscribe to timestamp changes
    unsubscribers.push(
        store.on('timestamp', () => {
            clearCache();
            callback();
        })
    );
    
    // Subscribe to product/model changes
    unsubscribers.push(
        store.on('product', () => {
            clearCache();
            callback();
        })
    );
    
    // Subscribe to level changes
    unsubscribers.push(
        store.on('level', () => {
            clearCache();
            callback();
        })
    );
    
    // Return cleanup function
    return () => {
        unsubscribers.forEach(unsub => unsub());
    };
}

