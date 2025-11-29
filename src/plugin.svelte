<div class="plugin__mobile-header">
    {title}
</div>
<section class="plugin__content density-plugin">
    <div
        class="plugin__title plugin__title--chevron-back"
        on:click={() => bcast.emit('rqstOpen', 'menu')}
    >
        {title}
        <div class="plugin__title__subtitle">
            Air density visualization layer
        </div>
    </div>

    <!-- Status Panel -->
    <div class="status-panel rounded-box mb-15">
        <div class="status-row">
            <span class="label">Status:</span>
            <span class="value" class:loading={isLoading}>
                {#if isLoading}
                    Loading... {loadingProgress}%
                {:else if error}
                    Error
                {:else if dataPoints > 0}
                    Active ({dataPoints} points)
                {:else}
                    Ready
                {/if}
            </span>
        </div>
        <div class="status-row">
            <span class="label">Level:</span>
            <span class="value">{currentLevel}</span>
        </div>
        <div class="status-row">
            <span class="label">Model:</span>
            <span class="value">{currentModel}</span>
        </div>
    </div>

    <!-- Controls -->
    <div class="controls-section mb-15">
        <div class="control-row">
            <label for="opacity-slider">Layer Opacity:</label>
            <input
                id="opacity-slider"
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                bind:value={layerOpacity}
                on:change={updateLayerOpacity}
            />
            <span class="value">{Math.round(layerOpacity * 100)}%</span>
        </div>
        
        <div class="control-row">
            <label for="color-scale">Color Scale:</label>
            <select id="color-scale" bind:value={colorScale} on:change={updateColorScale}>
                <option value="density">Density Optimized</option>
                <option value="viridis">Viridis</option>
                <option value="thermal">Thermal</option>
            </select>
        </div>
    </div>

    <!-- Action Buttons -->
    <div class="buttons-row mb-15">
        <button
            class="button button--variant-orange"
            on:click={loadDensityData}
            disabled={isLoading}
        >
            {isLoading ? 'Loading...' : 'Load Density Data'}
        </button>
        <button
            class="button"
            on:click={clearLayer}
            disabled={isLoading || dataPoints === 0}
        >
            Clear Layer
        </button>
    </div>

    <!-- Legend -->
    <div class="legend-section mb-15">
        <div class="legend-title">Air Density (kg/m³)</div>
        <div class="legend-bar">
            <canvas bind:this={legendCanvas} width="300" height="20"></canvas>
        </div>
        <div class="legend-labels">
            <span>{DENSITY_RANGE.min.toFixed(2)}</span>
            <span>{DENSITY_RANGE.standard.toFixed(3)} (std)</span>
            <span>{DENSITY_RANGE.max.toFixed(2)}</span>
        </div>
    </div>

    <!-- Current Point Info -->
    {#if selectedPoint}
        <div class="point-info rounded-box mb-15">
            <div class="point-info-title">Selected Location</div>
            <div class="info-row">
                <span class="label">Position:</span>
                <span class="value">{selectedPoint.lat.toFixed(3)}°, {selectedPoint.lon.toFixed(3)}°</span>
            </div>
            <div class="info-row">
                <span class="label">Temperature:</span>
                <span class="value">{selectedPoint.temp.toFixed(1)}°C</span>
            </div>
            <div class="info-row">
                <span class="label">Pressure:</span>
                <span class="value">{selectedPoint.pressure.toFixed(1)} hPa</span>
            </div>
            <div class="info-row">
                <span class="label">Humidity:</span>
                <span class="value">{selectedPoint.humidity.toFixed(0)}%</span>
            </div>
            <div class="info-row highlight">
                <span class="label">Air Density:</span>
                <span class="value">{selectedPoint.density?.toFixed(4)} kg/m³</span>
            </div>
        </div>
    {/if}

    <!-- Help Text -->
    <div class="help-text rounded-box bg-secondary">
        <p>
            <strong>How it works:</strong> This plugin calculates air density using 
            temperature, pressure, and humidity data from weather models.
        </p>
        <p>
            Click "Load Density Data" to fetch data for the current map view. 
            The layer will display a colored grid showing air density variations.
        </p>
        <p>
            <strong>Tip:</strong> Change the pressure level in Windy's main UI 
            to see air density at different altitudes.
        </p>
    </div>

    {#if error}
        <div class="error-box mt-15">
            <strong>Error:</strong> {error}
        </div>
    {/if}
</section>

<script lang="ts">
    import bcast from '@windy/broadcast';
    import { map } from '@windy/map';
    import store from '@windy/store';
    import { singleclick } from '@windy/singleclick';
    import { onDestroy, onMount } from 'svelte';

    import config from './pluginConfig';
    import { DENSITY_RANGE, formatDensity, calculateAirDensity } from './airDensity';
    import { createDensityLayer, type DensityDataPoint } from './DensityLayer';
    import { fetchGridData, fetchPointData, subscribeToStoreChanges, clearCache } from './dataFetcher';
    import { createLegendGradient, type ColorScaleType } from './colorScale';

    import type { LatLon } from '@windy/interfaces.d';

    const { title, name } = config;

    // State
    let isLoading = false;
    let loadingProgress = 0;
    let error: string | null = null;
    let dataPoints = 0;
    let selectedPoint: DensityDataPoint | null = null;
    let layerOpacity = 0.65;
    let colorScale: ColorScaleType = 'density';
    let currentLevel = 'surface';
    let currentModel = 'ecmwf';
    
    // Canvas ref for legend
    let legendCanvas: HTMLCanvasElement;
    
    // Layer instance
    let densityLayer: ReturnType<typeof createDensityLayer> | null = null;
    
    // Store subscription cleanup
    let unsubscribeStore: (() => void) | null = null;

    /**
     * Initialize the density layer
     */
    function initLayer() {
        if (densityLayer) {
            return;
        }
        
        densityLayer = createDensityLayer({
            opacity: layerOpacity,
            colorScale: colorScale,
            cellSize: 40
        });
        
        densityLayer.addTo(map);
    }

    /**
     * Remove the density layer
     */
    function removeLayer() {
        if (densityLayer) {
            map.removeLayer(densityLayer);
            densityLayer = null;
        }
    }

    /**
     * Load density data for current map view
     */
    async function loadDensityData() {
        if (isLoading) {
            return;
        }
        
        isLoading = true;
        loadingProgress = 0;
        error = null;
        
        try {
            initLayer();
            
            const bounds = map.getBounds();
            
            const data = await fetchGridData(
                bounds,
                name,
                (progress) => {
                    loadingProgress = progress;
                }
            );
            
            if (data.length === 0) {
                error = 'No data available for this area';
            } else if (densityLayer) {
                densityLayer.setDensityData(data);
                dataPoints = data.length;
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Unknown error occurred';
            console.error('Error loading density data:', err);
        } finally {
            isLoading = false;
            loadingProgress = 100;
        }
    }

    /**
     * Clear the layer data
     */
    function clearLayer() {
        if (densityLayer) {
            densityLayer.clearData();
        }
        dataPoints = 0;
        selectedPoint = null;
        clearCache();
    }

    /**
     * Update layer opacity
     */
    function updateLayerOpacity() {
        if (densityLayer) {
            densityLayer.setOpacity(layerOpacity);
        }
    }

    /**
     * Update color scale
     */
    function updateColorScale() {
        if (densityLayer) {
            densityLayer.setColorScale(colorScale);
        }
        renderLegend();
    }

    /**
     * Render the legend canvas
     */
    function renderLegend() {
        if (!legendCanvas) {
            return;
        }
        
        const ctx = legendCanvas.getContext('2d');
        if (!ctx) {
            return;
        }
        
        const width = legendCanvas.width;
        const height = legendCanvas.height;
        
        // Clear
        ctx.clearRect(0, 0, width, height);
        
        // Draw gradient
        const gradient = createLegendGradient(ctx, 0, 0, width, height, colorScale, true);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Add border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, width, height);
    }

    /**
     * Handle map click to show point info
     */
    async function handleMapClick(latLon: LatLon) {
        if (isLoading) {
            return;
        }
        
        try {
            const data = await fetchPointData(latLon, name);
            if (data) {
                selectedPoint = data;
            }
        } catch (err) {
            console.error('Error fetching point data:', err);
        }
    }

    /**
     * Update current level and model from store
     */
    function updateStoreValues() {
        const level = store.get('level');
        currentLevel = level || 'surface';
        
        const product = store.get('product');
        currentModel = product || 'ecmwf';
    }

    /**
     * Handle store changes
     */
    function handleStoreChange() {
        updateStoreValues();
        
        // If we have data loaded, refresh it
        if (dataPoints > 0 && !isLoading) {
            loadDensityData();
        }
    }

    // Plugin lifecycle
    export const onopen = () => {
        updateStoreValues();
        initLayer();
        
        // Render legend after mount
        setTimeout(renderLegend, 100);
    };

    onMount(() => {
        // Subscribe to map clicks
        singleclick.on(name, handleMapClick);
        
        // Subscribe to store changes
        unsubscribeStore = subscribeToStoreChanges(handleStoreChange);
        
        // Initial store values
        updateStoreValues();
        
        // Render legend
        setTimeout(renderLegend, 100);
    });

    onDestroy(() => {
        // Cleanup
        singleclick.off(name, handleMapClick);
        
        if (unsubscribeStore) {
            unsubscribeStore();
        }
        
        removeLayer();
        clearCache();
    });
</script>

<style lang="less">
    .density-plugin {
        .status-panel {
            background: rgba(0, 0, 0, 0.2);
            padding: 10px 15px;
            
            .status-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 5px;
                
                &:last-child {
                    margin-bottom: 0;
                }
                
                .label {
                    color: rgba(255, 255, 255, 0.7);
                }
                
                .value {
                    font-weight: 500;
                    
                    &.loading {
                        color: #ffa500;
                    }
                }
            }
        }
        
        .controls-section {
            .control-row {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
                
                label {
                    min-width: 100px;
                    color: rgba(255, 255, 255, 0.8);
                }
                
                input[type="range"] {
                    flex: 1;
                    height: 6px;
                    appearance: none;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 3px;
                    
                    &::-webkit-slider-thumb {
                        appearance: none;
                        width: 16px;
                        height: 16px;
                        background: #ff6600;
                        border-radius: 50%;
                        cursor: pointer;
                    }
                }
                
                select {
                    flex: 1;
                    padding: 5px 10px;
                    background: rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: white;
                    border-radius: 4px;
                    
                    option {
                        background: #333;
                    }
                }
                
                .value {
                    min-width: 40px;
                    text-align: right;
                }
            }
        }
        
        .buttons-row {
            display: flex;
            gap: 10px;
            
            .button {
                flex: 1;
                padding: 10px 15px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
                transition: opacity 0.2s;
                
                &:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                &--variant-orange {
                    background: #ff6600;
                    color: white;
                }
                
                &:not(.button--variant-orange) {
                    background: rgba(255, 255, 255, 0.15);
                    color: white;
                }
            }
        }
        
        .legend-section {
            .legend-title {
                font-weight: 500;
                margin-bottom: 8px;
                text-align: center;
            }
            
            .legend-bar {
                border-radius: 4px;
                overflow: hidden;
                
                canvas {
                    display: block;
                    width: 100%;
                    height: 20px;
                }
            }
            
            .legend-labels {
                display: flex;
                justify-content: space-between;
                margin-top: 5px;
                font-size: 11px;
                color: rgba(255, 255, 255, 0.7);
            }
        }
        
        .point-info {
            background: rgba(0, 0, 0, 0.3);
            padding: 12px 15px;
            
            .point-info-title {
                font-weight: 600;
                margin-bottom: 10px;
                color: #ff6600;
            }
            
            .info-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 5px;
                
                &.highlight {
                    margin-top: 8px;
                    padding-top: 8px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    
                    .label, .value {
                        font-weight: 600;
                        color: #4CAF50;
                    }
                }
                
                .label {
                    color: rgba(255, 255, 255, 0.7);
                }
            }
        }
        
        .help-text {
            padding: 12px 15px;
            font-size: 13px;
            line-height: 1.5;
            
            p {
                margin: 0 0 10px 0;
                
                &:last-child {
                    margin-bottom: 0;
                }
            }
            
            strong {
                color: #ff6600;
            }
        }
        
        .error-box {
            background: rgba(255, 0, 0, 0.2);
            border: 1px solid rgba(255, 0, 0, 0.4);
            padding: 10px 15px;
            border-radius: 4px;
            color: #ff6b6b;
        }
    }
    
    // Utility classes
    .mb-15 {
        margin-bottom: 15px;
    }
    
    .mt-15 {
        margin-top: 15px;
    }
    
    .rounded-box {
        border-radius: 6px;
    }
    
    .bg-secondary {
        background: rgba(255, 255, 255, 0.05);
    }
</style>
