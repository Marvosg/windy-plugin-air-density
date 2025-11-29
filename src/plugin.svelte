<div class="plugin__mobile-header">
    {title}
</div>
<section class="plugin__content density-plugin">
    <div
        class="plugin__title plugin__title--chevron-back"
        on:click={() => bcast.emit('rqstOpen', 'menu')}
    >
        {title}
    </div>

    <p class="intro-text">
        Click anywhere on the map to calculate air density at that location.
        Air density is calculated from temperature, pressure, and humidity.
    </p>

    <!-- Current Settings -->
    <div class="settings-panel rounded-box mb-15">
        <div class="setting-row">
            <span class="label">Model:</span>
            <span class="value">{currentModel}</span>
        </div>
        <div class="setting-row">
            <span class="label">Level:</span>
            <span class="value">{currentLevel}</span>
        </div>
    </div>

    <!-- Loading State -->
    {#if isLoading}
        <div class="loading-panel rounded-box mb-15">
            <div class="spinner"></div>
            <span>Loading weather data...</span>
        </div>
    {/if}

    <!-- Error State -->
    {#if error}
        <div class="error-box mb-15">
            <strong>Error:</strong> {error}
        </div>
    {/if}

    <!-- Results -->
    {#if result && !isLoading}
        <div class="result-panel rounded-box mb-15">
            <div class="result-header">
                <span class="location-name">{locationName || 'Selected Location'}</span>
                <span class="coordinates">{result.lat.toFixed(4)}°, {result.lon.toFixed(4)}°</span>
            </div>
            
            <div class="result-grid">
                <div class="result-item">
                    <span class="result-label">Temperature</span>
                    <span class="result-value">{result.temp.toFixed(1)}°C</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Pressure</span>
                    <span class="result-value">{result.pressure.toFixed(1)} hPa</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Humidity</span>
                    <span class="result-value">{result.humidity.toFixed(0)}%</span>
                </div>
            </div>

            <div class="density-result">
                <span class="density-label">Air Density</span>
                <span class="density-value">{result.density.toFixed(4)}</span>
                <span class="density-unit">kg/m³</span>
            </div>

            <div class="density-context">
                {#if result.density < 1.1}
                    <span class="context-tag low">Low density (warm/humid/high altitude)</span>
                {:else if result.density > 1.3}
                    <span class="context-tag high">High density (cold/dry/low altitude)</span>
                {:else}
                    <span class="context-tag normal">Near standard density (~1.225 kg/m³)</span>
                {/if}
            </div>
        </div>

        <!-- Comparison -->
        <div class="comparison-panel rounded-box mb-15">
            <div class="comparison-title">Comparison to Standard</div>
            <div class="comparison-bar">
                <div class="bar-track">
                    <div class="bar-marker standard" style="left: {standardPosition}%">
                        <span class="marker-label">Std</span>
                    </div>
                    <div class="bar-marker current" style="left: {currentPosition}%">
                        <span class="marker-label">Now</span>
                    </div>
                </div>
                <div class="bar-labels">
                    <span>0.9</span>
                    <span>1.225</span>
                    <span>1.5</span>
                </div>
            </div>
            <div class="comparison-diff">
                {#if result.density !== DENSITY_STANDARD}
                    {((result.density - DENSITY_STANDARD) / DENSITY_STANDARD * 100).toFixed(1)}% 
                    {result.density > DENSITY_STANDARD ? 'above' : 'below'} standard
                {:else}
                    At standard density
                {/if}
            </div>
        </div>
    {/if}

    <!-- No Result Yet -->
    {#if !result && !isLoading && !error}
        <div class="empty-state rounded-box">
            <div class="empty-icon">📍</div>
            <div class="empty-text">Click on the map to calculate air density</div>
        </div>
    {/if}

    <!-- Info Section -->
    <div class="info-section rounded-box bg-secondary">
        <details>
            <summary>About Air Density</summary>
            <p>
                Air density (ρ) is the mass per unit volume of Earth's atmosphere, 
                typically measured in kg/m³. It varies with:
            </p>
            <ul>
                <li><strong>Temperature:</strong> Warmer air is less dense</li>
                <li><strong>Pressure:</strong> Higher pressure means higher density</li>
                <li><strong>Humidity:</strong> Moist air is slightly less dense than dry air</li>
                <li><strong>Altitude:</strong> Density decreases with elevation</li>
            </ul>
            <p>
                Standard sea-level density is approximately <strong>1.225 kg/m³</strong> 
                at 15°C and 1013.25 hPa.
            </p>
        </details>
    </div>
</section>

<script lang="ts">
    import bcast from '@windy/broadcast';
    import { map, markers } from '@windy/map';
    import store from '@windy/store';
    import { getPointForecastData } from '@windy/fetch';
    import * as reverseName from '@windy/reverseName';
    import { onDestroy, onMount } from 'svelte';

    import config from './pluginConfig';
    import { calculateAirDensity } from './airDensity';

    import type { LatLon, WeatherDataPayload, DataHash } from '@windy/interfaces.d';
    import type { HttpPayload } from '@windy/http.d';

    const { title, name } = config;
    const DENSITY_STANDARD = 1.225;
    const DENSITY_MIN = 0.9;
    const DENSITY_MAX = 1.5;

    interface DensityResult {
        lat: number;
        lon: number;
        temp: number;
        pressure: number;
        humidity: number;
        density: number;
    }

    // State
    let isLoading = false;
    let error: string | null = null;
    let result: DensityResult | null = null;
    let locationName: string | null = null;
    let currentModel = 'ecmwf';
    let currentLevel = 'surface';
    let marker: L.Marker | null = null;

    // Computed positions for comparison bar
    $: standardPosition = ((DENSITY_STANDARD - DENSITY_MIN) / (DENSITY_MAX - DENSITY_MIN)) * 100;
    $: currentPosition = result 
        ? Math.max(0, Math.min(100, ((result.density - DENSITY_MIN) / (DENSITY_MAX - DENSITY_MIN)) * 100))
        : 50;

    /**
     * Update store values
     */
    function updateStoreValues() {
        currentModel = store.get('product') || 'ecmwf';
        currentLevel = store.get('level') || 'surface';
    }

    /**
     * Place or update the marker on the map
     */
    function updateMarker(lat: number, lon: number) {
        if (marker) {
            marker.setLatLng([lat, lon]);
        } else {
            marker = L.marker([lat, lon], { 
                icon: markers.pulsatingIcon 
            }).addTo(map);
        }
    }

    /**
     * Remove the marker from the map
     */
    function removeMarker() {
        if (marker) {
            marker.remove();
            marker = null;
        }
    }

    /**
     * Handle click on the map
     */
    async function handleMapClick(latLon: LatLon) {
        const { lat, lon } = latLon;
        
        isLoading = true;
        error = null;
        locationName = null;
        
        // Update marker position
        updateMarker(lat, lon);
        
        // Get location name
        reverseName.get(latLon).then(({ name: locName }) => {
            locationName = locName;
        }).catch(() => {
            // Ignore reverse geocoding errors
        });

        try {
            const model = store.get('product') || 'ecmwf';
            
            const response: HttpPayload<WeatherDataPayload<DataHash>> = await getPointForecastData(
                model,
                latLon,
                name
            );
            
            if (!response.data || !response.data.data) {
                throw new Error('No forecast data available');
            }

            const weatherData = response.data.data;
            const currentTs = store.get('timestamp') || Date.now();
            
            // Find the closest timestamp index
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

            // Extract weather parameters
            // Temperature: try temp-surface, temp, or gh (geopotential height based)
            let tempValue = weatherData['temp-surface']?.[timeIndex] 
                ?? weatherData.temp?.[timeIndex];
            
            // Pressure: try pressure or sea level pressure
            let pressureValue = weatherData.pressure?.[timeIndex] 
                ?? weatherData['sea_level_pressure']?.[timeIndex]
                ?? weatherData.slp?.[timeIndex];
            
            // Humidity: try rh-surface, rh, or default
            let humidityValue = weatherData['rh-surface']?.[timeIndex] 
                ?? weatherData.rh?.[timeIndex];

            // Debug: log what we got
            console.log('Weather data keys:', Object.keys(weatherData));
            console.log('Raw values:', { tempValue, pressureValue, humidityValue });

            if (tempValue === undefined) {
                throw new Error('Temperature data not available');
            }
            
            if (pressureValue === undefined) {
                throw new Error('Pressure data not available');
            }

            // Convert temperature from Kelvin to Celsius if needed
            let tempCelsius = tempValue;
            if (tempValue > 200) {
                // Likely Kelvin
                tempCelsius = tempValue - 273.15;
            }

            // Convert pressure to hPa if needed
            let pressureHPa = pressureValue;
            if (pressureValue > 10000) {
                // Likely in Pa
                pressureHPa = pressureValue / 100;
            }

            // Use default humidity if not available
            const humidity = humidityValue ?? 50;

            // Calculate air density
            const density = calculateAirDensity(tempCelsius, pressureHPa, humidity);

            result = {
                lat,
                lon,
                temp: tempCelsius,
                pressure: pressureHPa,
                humidity,
                density
            };

        } catch (err) {
            console.error('Error calculating air density:', err);
            error = err instanceof Error ? err.message : 'Failed to fetch weather data';
            result = null;
        } finally {
            isLoading = false;
        }
    }

    /**
     * Direct map click handler (Leaflet event)
     */
    function onMapClick(e: L.LeafletMouseEvent) {
        console.log('[Air Density] Map click event:', e.latlng);
        const latLon: LatLon = { lat: e.latlng.lat, lon: e.latlng.lng };
        handleMapClick(latLon);
    }

    // Plugin lifecycle
    export const onopen = (params?: LatLon) => {
        console.log('[Air Density] Plugin opened with params:', params);
        updateStoreValues();
        
        // Register map click handler when plugin opens
        map.on('click', onMapClick);
        console.log('[Air Density] Map click handler registered');
        
        // If opened with coordinates (e.g., from context menu), calculate immediately
        if (params && params.lat !== undefined && params.lon !== undefined) {
            handleMapClick(params);
        }
    };

    onMount(() => {
        console.log('[Air Density] onMount called');
        
        // Subscribe to store changes
        store.on('product', updateStoreValues);
        store.on('level', updateStoreValues);
        
        updateStoreValues();
    });

    onDestroy(() => {
        console.log('[Air Density] onDestroy called, cleaning up');
        map.off('click', onMapClick);
        store.off('product', updateStoreValues);
        store.off('level', updateStoreValues);
        removeMarker();
    });
</script>

<style lang="less">
    .density-plugin {
        .intro-text {
            margin: 0 0 15px 0;
            line-height: 1.5;
            color: rgba(255, 255, 255, 0.8);
            font-size: 14px;
        }

        .settings-panel {
            background: rgba(0, 0, 0, 0.2);
            padding: 10px 15px;
            display: flex;
            gap: 20px;
            
            .setting-row {
                display: flex;
                gap: 8px;
                
                .label {
                    color: rgba(255, 255, 255, 0.6);
                }
                
                .value {
                    font-weight: 500;
                }
            }
        }

        .loading-panel {
            background: rgba(255, 165, 0, 0.15);
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            
            .spinner {
                width: 20px;
                height: 20px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-top-color: #ff6600;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
        }

        .error-box {
            background: rgba(255, 0, 0, 0.15);
            border: 1px solid rgba(255, 0, 0, 0.3);
            padding: 12px 15px;
            border-radius: 6px;
            color: #ff6b6b;
        }

        .result-panel {
            background: rgba(0, 0, 0, 0.25);
            padding: 15px;
            
            .result-header {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                
                .location-name {
                    font-weight: 600;
                    font-size: 16px;
                }
                
                .coordinates {
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.6);
                }
            }
            
            .result-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin-bottom: 15px;
                
                .result-item {
                    text-align: center;
                    padding: 10px;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 6px;
                    
                    .result-label {
                        display: block;
                        font-size: 11px;
                        color: rgba(255, 255, 255, 0.6);
                        margin-bottom: 4px;
                    }
                    
                    .result-value {
                        display: block;
                        font-size: 16px;
                        font-weight: 600;
                    }
                }
            }
            
            .density-result {
                text-align: center;
                padding: 15px;
                background: linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(33, 150, 243, 0.2));
                border-radius: 8px;
                margin-bottom: 10px;
                
                .density-label {
                    display: block;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.7);
                    margin-bottom: 5px;
                }
                
                .density-value {
                    display: block;
                    font-size: 32px;
                    font-weight: 700;
                    color: #4CAF50;
                }
                
                .density-unit {
                    font-size: 14px;
                    color: rgba(255, 255, 255, 0.7);
                }
            }
            
            .density-context {
                text-align: center;
                
                .context-tag {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    
                    &.low {
                        background: rgba(255, 152, 0, 0.2);
                        color: #ffb74d;
                    }
                    
                    &.high {
                        background: rgba(33, 150, 243, 0.2);
                        color: #64b5f6;
                    }
                    
                    &.normal {
                        background: rgba(76, 175, 80, 0.2);
                        color: #81c784;
                    }
                }
            }
        }

        .comparison-panel {
            background: rgba(0, 0, 0, 0.2);
            padding: 15px;
            
            .comparison-title {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.7);
                margin-bottom: 12px;
            }
            
            .bar-track {
                position: relative;
                height: 8px;
                background: linear-gradient(to right, #ff9800, #4CAF50, #2196F3);
                border-radius: 4px;
                margin-bottom: 25px;
                
                .bar-marker {
                    position: absolute;
                    top: -4px;
                    transform: translateX(-50%);
                    
                    &::before {
                        content: '';
                        display: block;
                        width: 16px;
                        height: 16px;
                        border-radius: 50%;
                        border: 2px solid white;
                    }
                    
                    .marker-label {
                        position: absolute;
                        top: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        font-size: 10px;
                        white-space: nowrap;
                    }
                    
                    &.standard::before {
                        background: rgba(255, 255, 255, 0.5);
                    }
                    
                    &.current::before {
                        background: #4CAF50;
                        box-shadow: 0 0 8px rgba(76, 175, 80, 0.6);
                    }
                }
            }
            
            .bar-labels {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: rgba(255, 255, 255, 0.5);
            }
            
            .comparison-diff {
                margin-top: 10px;
                text-align: center;
                font-size: 13px;
                color: rgba(255, 255, 255, 0.8);
            }
        }

        .empty-state {
            text-align: center;
            padding: 40px 20px;
            background: rgba(0, 0, 0, 0.15);
            
            .empty-icon {
                font-size: 48px;
                margin-bottom: 15px;
            }
            
            .empty-text {
                color: rgba(255, 255, 255, 0.7);
                font-size: 14px;
            }
        }

        .info-section {
            padding: 15px;
            font-size: 13px;
            
            details {
                summary {
                    cursor: pointer;
                    font-weight: 500;
                    margin-bottom: 10px;
                    
                    &:hover {
                        color: #ff6600;
                    }
                }
                
                p {
                    margin: 10px 0;
                    line-height: 1.5;
                    color: rgba(255, 255, 255, 0.8);
                }
                
                ul {
                    margin: 10px 0;
                    padding-left: 20px;
                    
                    li {
                        margin: 5px 0;
                        line-height: 1.4;
                        color: rgba(255, 255, 255, 0.8);
                    }
                }
            }
        }
    }

    // Utilities
    .mb-15 {
        margin-bottom: 15px;
    }

    .rounded-box {
        border-radius: 6px;
    }

    .bg-secondary {
        background: rgba(255, 255, 255, 0.05);
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }
</style>
