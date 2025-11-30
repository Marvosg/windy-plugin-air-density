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

    <!-- Mode Toggle -->
    <div class="mode-toggle mb-15">
        <button 
            class="mode-btn" 
            class:active={trackingMode}
            on:click={() => setTrackingMode(true)}
        >
            ⊕ Track Center
        </button>
        <button 
            class="mode-btn" 
            class:active={!trackingMode}
            on:click={() => setTrackingMode(false)}
        >
            📍 Click to Select
        </button>
    </div>

    <!-- Current Settings -->
    <div class="settings-panel rounded-box mb-15">
        <div class="setting-row">
            <span class="label">Model:</span>
            <span class="value">{displayModel}{#if isLoading}...{/if}</span>
        </div>
    </div>

    <!-- Error State -->
    {#if error}
        <div class="error-box mb-15">
            {error}
        </div>
    {/if}

    <!-- Results -->
    {#if result}
        <div class="result-panel rounded-box mb-15" class:is-loading={isLoading}>
            {#if isLoading}
                <div class="loading-overlay">
                    <div class="spinner"></div>
                </div>
            {/if}
            <div class="result-header">
                <div class="location-info">
                    <span class="location-name">{locationName || 'Location'}</span>
                    <span class="coordinates">{result.lat.toFixed(4)}°, {result.lon.toFixed(4)}°</span>
                </div>
                <span class="updated-at">{lastUpdated}</span>
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
                    <span class="context-tag low">Low (warm/low pressure)</span>
                {:else if result.density > 1.3}
                    <span class="context-tag high">High (cold/high pressure)</span>
                {:else}
                    <span class="context-tag normal">Normal (~1.225)</span>
                {/if}
            </div>
        </div>

        <!-- Comparison -->
        <div class="comparison-panel rounded-box mb-15">
            <div class="comparison-title">vs Standard (1.225 kg/m³)</div>
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
                {((result.density - DENSITY_STANDARD) / DENSITY_STANDARD * 100).toFixed(1)}% 
                {result.density > DENSITY_STANDARD ? 'above' : 'below'} standard
            </div>
        </div>
    {/if}

    <!-- No Result Yet -->
    {#if !result && !isLoading && !error}
        <div class="empty-state rounded-box">
            <div class="empty-icon">{trackingMode ? '⊕' : '📍'}</div>
            <div class="empty-text">
                {trackingMode ? 'Pan the map to measure' : 'Click on map to measure'}
            </div>
        </div>
    {/if}

    <!-- Info Section -->
    <div class="info-section rounded-box bg-secondary">
        <details>
            <summary>About Air Density</summary>
            <p>
                Air density varies with temperature, pressure, humidity, and altitude.
                Standard sea-level density is <strong>1.225 kg/m³</strong> at 15°C, 1013.25 hPa.
            </p>
            <p class="note">
                Data uses surface-level values from the selected weather model.
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
    const AUTO_REFRESH_INTERVAL = 60000;

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
    let displayModel = 'ecmwf';
    let lastUpdated: string = '';
    let marker: L.Marker | null = null;
    let centerMarker: L.CircleMarker | null = null;
    let trackingMode = true;
    let currentLocation: LatLon | null = null;
    let moveTimeout: ReturnType<typeof setTimeout> | null = null;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;
    
    function formatTime(date: Date): string {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // Computed positions for comparison bar
    $: standardPosition = ((DENSITY_STANDARD - DENSITY_MIN) / (DENSITY_MAX - DENSITY_MIN)) * 100;
    $: currentPosition = result 
        ? Math.max(0, Math.min(100, ((result.density - DENSITY_MIN) / (DENSITY_MAX - DENSITY_MIN)) * 100))
        : 50;

    // Global models that cover everywhere
    const GLOBAL_MODELS = ['ecmwf', 'gfs', 'icon', 'mblue', 'cams', 'cfsv2'];
    
    // Regional models
    const REGIONAL_MODELS = [
        'iconEu', 'iconD2', 'arome', 'aromeAntilles', 'aromeFrance', 'aromeReunion',
        'ukv', 'nam', 'namConus', 'namHawaii', 'namAlaska', 'hrrr', 'bomAccess',
        'czeAladin', 'canHrdps', 'canRdwps', 'jmaMsm', 'jmaGsm',
        'iconWaves', 'gwam', 'ewam', 'efi'
    ];
    
    const FORECAST_MODELS = [...GLOBAL_MODELS, ...REGIONAL_MODELS];
    
    function isForecastModel(product: string): boolean {
        return FORECAST_MODELS.includes(product);
    }
    
    function getModelForFetch(): string {
        const product = store.get('product') || 'ecmwf';
        return isForecastModel(product) ? product : 'ecmwf';
    }

    function getDisplayModelName(): string {
        const product = store.get('product') || 'ecmwf';
        if (isForecastModel(product)) {
            return product;
        }
        return `${product} → ecmwf`;
    }

    /**
     * Place or update the click marker
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

    function removeMarker() {
        if (marker) {
            marker.remove();
            marker = null;
        }
    }

    /**
     * Update center marker (crosshair) for tracking mode
     * Using L.circleMarker which is simpler and more reliable
     */
    function updateCenterMarker() {
        const center = map.getCenter();
        
        if (centerMarker) {
            centerMarker.setLatLng(center);
        } else {
            // Create a simple circle marker as crosshair
            centerMarker = L.circleMarker(center, {
                radius: 16,
                color: '#ff6600',
                weight: 3,
                fillColor: '#ff6600',
                fillOpacity: 0.3,
                className: 'density-center-marker'
            }).addTo(map);
        }
    }

    function removeCenterMarker() {
        if (centerMarker) {
            centerMarker.remove();
            centerMarker = null;
        }
    }

    /**
     * Main calculation function
     */
    async function calculateDensity(latLon: LatLon, silent: boolean = false) {
        const { lat, lon } = latLon;
        
        if (!silent) {
            isLoading = true;
        }
        error = null;
        currentLocation = latLon;
        
        // Update visual marker
        if (trackingMode) {
            updateCenterMarker();
        } else {
            updateMarker(lat, lon);
        }
        
        // Get location name async
        reverseName.get(latLon).then(({ name: locName }) => {
            locationName = locName;
        }).catch(() => {
            locationName = null;
        });

        // Determine model and update display IMMEDIATELY
        const requestedModel = getModelForFetch();
        displayModel = getDisplayModelName();
        
        let usedModel = requestedModel;
        let response: HttpPayload<WeatherDataPayload<DataHash>>;

        try {
            try {
                response = await getPointForecastData(requestedModel, latLon, name);
            } catch (fetchErr) {
                // Fallback to ecmwf for regional model failures
                if (requestedModel !== 'ecmwf' && !GLOBAL_MODELS.includes(requestedModel)) {
                    console.log(`[Air Density] ${requestedModel} failed, falling back to ecmwf`);
                    usedModel = 'ecmwf';
                    displayModel = `${requestedModel} → ecmwf`;
                    response = await getPointForecastData('ecmwf', latLon, name);
                } else {
                    throw fetchErr;
                }
            }
            
            if (!response.data || !response.data.data) {
                throw new Error('No forecast data available');
            }

            const weatherData = response.data.data;
            const currentTs = store.get('timestamp') || Date.now();
            
            // Find closest timestamp
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
            let tempValue = weatherData['temp-surface']?.[timeIndex] 
                ?? weatherData.temp?.[timeIndex];
            
            let pressureValue = weatherData.pressure?.[timeIndex] 
                ?? weatherData['sea_level_pressure']?.[timeIndex]
                ?? weatherData.slp?.[timeIndex];
            
            let humidityValue = weatherData['rh-surface']?.[timeIndex] 
                ?? weatherData.rh?.[timeIndex];

            if (tempValue === undefined) {
                throw new Error('Temperature data not available');
            }
            
            if (pressureValue === undefined) {
                throw new Error('Pressure data not available');
            }

            // Convert units
            let tempCelsius = tempValue > 200 ? tempValue - 273.15 : tempValue;
            let pressureHPa = pressureValue > 10000 ? pressureValue / 100 : pressureValue;
            const humidity = humidityValue ?? 50;
            
            const density = calculateAirDensity(tempCelsius, pressureHPa, humidity);

            result = {
                lat,
                lon,
                temp: tempCelsius,
                pressure: pressureHPa,
                humidity,
                density
            };
            
            lastUpdated = formatTime(new Date());

        } catch (err) {
            console.error('Error calculating air density:', err);
            error = err instanceof Error ? err.message : 'Failed to fetch data';
            if (!silent) {
                result = null;
            }
        } finally {
            isLoading = false;
        }
    }

    function onMapClick(e: L.LeafletMouseEvent) {
        if (!trackingMode) {
            calculateDensity({ lat: e.latlng.lat, lon: e.latlng.lng });
        }
    }

    function onMapMove() {
        if (trackingMode) {
            updateCenterMarker();
        }
    }

    function onMapMoveEnd() {
        if (trackingMode) {
            if (moveTimeout) clearTimeout(moveTimeout);
            moveTimeout = setTimeout(() => {
                const center = map.getCenter();
                calculateDensity({ lat: center.lat, lon: center.lng });
            }, 300);
        }
    }

    function onStoreChange() {
        // Update model display immediately
        displayModel = getDisplayModelName();
        
        // Recalculate if we have a location
        if (currentLocation && !isLoading) {
            calculateDensity(currentLocation);
        }
    }

    function startAutoRefresh() {
        stopAutoRefresh();
        refreshInterval = setInterval(() => {
            if (currentLocation && !isLoading) {
                calculateDensity(currentLocation, true);
            }
        }, AUTO_REFRESH_INTERVAL);
    }

    function stopAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    }

    function setTrackingMode(enabled: boolean) {
        trackingMode = enabled;
        
        if (enabled) {
            removeMarker();
            updateCenterMarker();
            const center = map.getCenter();
            calculateDensity({ lat: center.lat, lon: center.lng });
        } else {
            removeCenterMarker();
        }
    }

    export const onopen = (params?: LatLon) => {
        displayModel = getDisplayModelName();
        
        map.on('click', onMapClick);
        map.on('move', onMapMove);
        map.on('moveend', onMapMoveEnd);
        
        startAutoRefresh();
        
        if (params && params.lat !== undefined && params.lon !== undefined) {
            trackingMode = false;
            calculateDensity(params);
        } else if (trackingMode) {
            updateCenterMarker();
            const center = map.getCenter();
            calculateDensity({ lat: center.lat, lon: center.lng });
        }
    };

    onMount(() => {
        store.on('product', onStoreChange);
        store.on('timestamp', onStoreChange);
        displayModel = getDisplayModelName();
    });

    onDestroy(() => {
        map.off('click', onMapClick);
        map.off('move', onMapMove);
        map.off('moveend', onMapMoveEnd);
        store.off('product', onStoreChange);
        store.off('timestamp', onStoreChange);
        removeMarker();
        removeCenterMarker();
        stopAutoRefresh();
        if (moveTimeout) clearTimeout(moveTimeout);
    });
</script>

<style lang="less">
    .density-plugin {
        .mode-toggle {
            display: flex;
            gap: 8px;
            
            .mode-btn {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: rgba(0, 0, 0, 0.2);
                color: rgba(255, 255, 255, 0.7);
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
                
                &:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                
                &.active {
                    background: rgba(255, 102, 0, 0.3);
                    border-color: #ff6600;
                    color: white;
                }
            }
        }

        .settings-panel {
            background: rgba(0, 0, 0, 0.2);
            padding: 10px 15px;
            
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

        .error-box {
            background: rgba(255, 0, 0, 0.15);
            border: 1px solid rgba(255, 0, 0, 0.3);
            padding: 10px 15px;
            border-radius: 6px;
            color: #ff6b6b;
            font-size: 13px;
        }

        .result-panel {
            background: rgba(0, 0, 0, 0.25);
            padding: 15px;
            position: relative;
            
            &.is-loading {
                opacity: 0.7;
            }
            
            .loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
                z-index: 10;
                
                .spinner {
                    width: 24px;
                    height: 24px;
                    border: 3px solid rgba(255, 255, 255, 0.3);
                    border-top-color: #ff6600;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
            }
            
            .result-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                
                .location-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                
                .location-name {
                    font-weight: 600;
                    font-size: 15px;
                }
                
                .coordinates {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.5);
                }
                
                .updated-at {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.5);
                }
            }
            
            .result-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin-bottom: 12px;
                
                .result-item {
                    text-align: center;
                    padding: 8px;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 6px;
                    
                    .result-label {
                        display: block;
                        font-size: 10px;
                        color: rgba(255, 255, 255, 0.6);
                        margin-bottom: 3px;
                    }
                    
                    .result-value {
                        display: block;
                        font-size: 15px;
                        font-weight: 600;
                    }
                }
            }
            
            .density-result {
                text-align: center;
                padding: 12px;
                background: linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(33, 150, 243, 0.2));
                border-radius: 8px;
                margin-bottom: 8px;
                
                .density-label {
                    display: block;
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.7);
                    margin-bottom: 4px;
                }
                
                .density-value {
                    display: block;
                    font-size: 28px;
                    font-weight: 700;
                    color: #4CAF50;
                }
                
                .density-unit {
                    font-size: 13px;
                    color: rgba(255, 255, 255, 0.7);
                }
            }
            
            .density-context {
                text-align: center;
                
                .context-tag {
                    display: inline-block;
                    padding: 3px 10px;
                    border-radius: 10px;
                    font-size: 11px;
                    
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
            padding: 12px;
            
            .comparison-title {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.7);
                margin-bottom: 10px;
            }
            
            .bar-track {
                position: relative;
                height: 8px;
                background: linear-gradient(to right, #ff9800, #4CAF50, #2196F3);
                border-radius: 4px;
                margin-bottom: 22px;
                
                .bar-marker {
                    position: absolute;
                    top: -4px;
                    transform: translateX(-50%);
                    
                    &::before {
                        content: '';
                        display: block;
                        width: 14px;
                        height: 14px;
                        border-radius: 50%;
                        border: 2px solid white;
                    }
                    
                    .marker-label {
                        position: absolute;
                        top: 18px;
                        left: 50%;
                        transform: translateX(-50%);
                        font-size: 9px;
                        white-space: nowrap;
                    }
                    
                    &.standard::before {
                        background: rgba(255, 255, 255, 0.5);
                    }
                    
                    &.current::before {
                        background: #4CAF50;
                        box-shadow: 0 0 6px rgba(76, 175, 80, 0.6);
                    }
                }
            }
            
            .bar-labels {
                display: flex;
                justify-content: space-between;
                font-size: 10px;
                color: rgba(255, 255, 255, 0.5);
            }
            
            .comparison-diff {
                margin-top: 8px;
                text-align: center;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.8);
            }
        }

        .empty-state {
            text-align: center;
            padding: 30px 20px;
            background: rgba(0, 0, 0, 0.15);
            
            .empty-icon {
                font-size: 40px;
                margin-bottom: 10px;
            }
            
            .empty-text {
                color: rgba(255, 255, 255, 0.7);
                font-size: 13px;
            }
        }

        .info-section {
            padding: 12px;
            font-size: 12px;
            
            details {
                summary {
                    cursor: pointer;
                    font-weight: 500;
                    
                    &:hover {
                        color: #ff6600;
                    }
                }
                
                p {
                    margin: 8px 0;
                    line-height: 1.4;
                    color: rgba(255, 255, 255, 0.8);
                    
                    &.note {
                        font-size: 11px;
                        color: rgba(255, 255, 255, 0.6);
                        font-style: italic;
                    }
                }
            }
        }
    }

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
