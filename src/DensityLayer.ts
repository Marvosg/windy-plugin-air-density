/**
 * Density Layer Module
 * 
 * Custom Leaflet layer that renders air density as a colored grid overlay.
 * Uses canvas rendering for performance.
 */

import { calculateAirDensity, normalizeDensity, DENSITY_RANGE } from './airDensity';
import { getColor, rgbToString, type ColorScaleType } from './colorScale';

export interface DensityDataPoint {
    lat: number;
    lon: number;
    temp: number;      // Celsius
    pressure: number;  // hPa
    humidity: number;  // %
    density?: number;  // Calculated kg/m³
}

export interface DensityLayerOptions {
    opacity?: number;
    cellSize?: number;  // Size of each grid cell in pixels
    colorScale?: ColorScaleType;
    minZoom?: number;
    maxZoom?: number;
}

const DEFAULT_OPTIONS: Required<DensityLayerOptions> = {
    opacity: 0.65,
    cellSize: 40,
    colorScale: 'density',
    minZoom: 3,
    maxZoom: 12
};

/**
 * Create the Density Layer class extending L.GridLayer
 */
export function createDensityLayerClass(): typeof L.GridLayer {
    return L.GridLayer.extend({
        options: { ...DEFAULT_OPTIONS },
        
        _densityData: new Map<string, DensityDataPoint>(),
        _colorScale: 'density' as ColorScaleType,
        
        initialize: function(options?: DensityLayerOptions) {
            L.Util.setOptions(this, options);
            this._colorScale = options?.colorScale || 'density';
        },
        
        /**
         * Update density data for rendering
         */
        setDensityData: function(data: DensityDataPoint[]) {
            this._densityData.clear();
            
            data.forEach(point => {
                // Calculate density if not provided
                if (point.density === undefined) {
                    point.density = calculateAirDensity(point.temp, point.pressure, point.humidity);
                }
                const key = `${point.lat.toFixed(2)}_${point.lon.toFixed(2)}`;
                this._densityData.set(key, point);
            });
            
            this.redraw();
        },
        
        /**
         * Get cached density data
         */
        getDensityData: function(): Map<string, DensityDataPoint> {
            return this._densityData;
        },
        
        /**
         * Clear all density data
         */
        clearData: function() {
            this._densityData.clear();
            this.redraw();
        },
        
        /**
         * Set the color scale type
         */
        setColorScale: function(scale: ColorScaleType) {
            this._colorScale = scale;
            this.redraw();
        },
        
        /**
         * Create a tile for the grid layer
         */
        createTile: function(coords: L.Coords, done: L.DoneCallback): HTMLCanvasElement {
            const tile = L.DomUtil.create('canvas', 'density-tile') as HTMLCanvasElement;
            const size = this.getTileSize();
            tile.width = size.x;
            tile.height = size.y;
            
            const ctx = tile.getContext('2d');
            if (!ctx) {
                done(new Error('Could not get canvas context'), tile);
                return tile;
            }
            
            // Render the tile asynchronously
            this._renderTile(ctx, coords, size, () => {
                done(undefined, tile);
            });
            
            return tile;
        },
        
        /**
         * Render density data onto a tile
         */
        _renderTile: function(
            ctx: CanvasRenderingContext2D,
            coords: L.Coords,
            size: L.Point,
            callback: () => void
        ) {
            const map = this._map;
            if (!map || this._densityData.size === 0) {
                // Draw placeholder if no data
                ctx.fillStyle = 'rgba(128, 128, 128, 0.1)';
                ctx.fillRect(0, 0, size.x, size.y);
                callback();
                return;
            }
            
            const cellSize = this.options.cellSize;
            const opacity = this.options.opacity;
            const zoom = coords.z;
            
            // Calculate tile bounds in lat/lng
            const nwPoint = L.point(coords.x * size.x, coords.y * size.y);
            const sePoint = L.point((coords.x + 1) * size.x, (coords.y + 1) * size.y);
            const nwLatLng = map.unproject(nwPoint, zoom);
            const seLatLng = map.unproject(sePoint, zoom);
            
            // Number of cells in this tile
            const cellsX = Math.ceil(size.x / cellSize);
            const cellsY = Math.ceil(size.y / cellSize);
            
            // Lat/lng step per cell
            const latStep = (nwLatLng.lat - seLatLng.lat) / cellsY;
            const lngStep = (seLatLng.lng - nwLatLng.lng) / cellsX;
            
            // Render cells
            for (let cy = 0; cy < cellsY; cy++) {
                for (let cx = 0; cx < cellsX; cx++) {
                    const cellLat = nwLatLng.lat - (cy + 0.5) * latStep;
                    const cellLng = nwLatLng.lng + (cx + 0.5) * lngStep;
                    
                    // Find nearest data point or interpolate
                    const density = this._interpolateDensity(cellLat, cellLng);
                    
                    if (density !== null) {
                        const normalized = normalizeDensity(density);
                        const color = getColor(normalized, this._colorScale);
                        
                        ctx.fillStyle = rgbToString(color, opacity);
                        ctx.fillRect(
                            cx * cellSize,
                            cy * cellSize,
                            cellSize,
                            cellSize
                        );
                    }
                }
            }
            
            callback();
        },
        
        /**
         * Interpolate density value at a given location using inverse distance weighting
         */
        _interpolateDensity: function(lat: number, lng: number): number | null {
            if (this._densityData.size === 0) {
                return null;
            }
            
            const searchRadius = 5; // degrees
            let totalWeight = 0;
            let weightedSum = 0;
            let nearestDistance = Infinity;
            let nearestDensity: number | null = null;
            
            this._densityData.forEach((point: DensityDataPoint) => {
                const dLat = point.lat - lat;
                const dLng = point.lon - lng;
                const distance = Math.sqrt(dLat * dLat + dLng * dLng);
                
                if (distance < searchRadius && point.density !== undefined) {
                    if (distance < 0.01) {
                        // Very close, just use this value
                        nearestDensity = point.density;
                        nearestDistance = 0;
                        return;
                    }
                    
                    // Inverse distance weighting (IDW)
                    const weight = 1 / (distance * distance);
                    weightedSum += point.density * weight;
                    totalWeight += weight;
                    
                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestDensity = point.density;
                    }
                }
            });
            
            if (nearestDistance === 0) {
                return nearestDensity;
            }
            
            if (totalWeight > 0) {
                return weightedSum / totalWeight;
            }
            
            return nearestDensity;
        },
        
        /**
         * Get density range info for legend
         */
        getDensityRange: function() {
            return DENSITY_RANGE;
        }
    });
}

/**
 * Factory function to create a density layer instance
 */
export function createDensityLayer(options?: DensityLayerOptions): L.GridLayer & {
    setDensityData: (data: DensityDataPoint[]) => void;
    getDensityData: () => Map<string, DensityDataPoint>;
    clearData: () => void;
    setColorScale: (scale: ColorScaleType) => void;
    getDensityRange: () => typeof DENSITY_RANGE;
} {
    const DensityLayerClass = createDensityLayerClass();
    return new DensityLayerClass(options) as any;
}

