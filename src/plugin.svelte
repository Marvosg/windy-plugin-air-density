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

    <!-- Model Selection -->
    <div class="settings-panel rounded-box mb-15">
        <div class="model-info">
            <div class="model-row">
                <span class="model-label">Selected:</span>
                <span class="model-value">{currentProduct.toUpperCase()}</span>
            </div>
            {#if result}
                <div class="model-row">
                    <span class="model-label">Used:</span>
                    <span class="model-value" class:fallback={usedModel !== requestedForResult}>
                        {usedModel.toUpperCase()}
                        {#if usedModel !== requestedForResult}
                            <span class="fallback-note">(fallback)</span>
                        {/if}
                    </span>
                </div>
            {/if}
        </div>
        <div class="model-chips">
            {#each QUICK_MODELS as model}
                <button 
                    class="model-chip" 
                    class:active={currentProduct === model.id}
                    on:click={() => selectModel(model.id)}
                >
                    {model.label}
                </button>
            {/each}
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
        <div class="result-panel rounded-box mb-15">
            <div class="loading-overlay" class:visible={showLoadingOverlay}>
                <div class="spinner"></div>
            </div>
            <div class="result-header">
                <div class="location-info">
                    <span class="location-name">{locationName || 'Location'}</span>
                    <span class="coordinates">{result.lat.toFixed(4)}°, {result.lon.toFixed(4)}°</span>
                </div>
                <div class="time-info">
                    <span class="updated-at">{lastUpdated}</span>
                    <label class="track-now-label">
                        <input type="checkbox" bind:checked={trackNow} on:change={onTrackNowChange} />
                        <span>Current time</span>
                    </label>
                </div>
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
                    <div class="bar-marker current" style="left: {currentPosition}%; --marker-color: {getGradientColor(currentPosition)}">
                        <span class="marker-label">{isCurrentTime ? 'Now' : 'Val'}</span>
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
            <p class="credit">
                Made by Mare.<br>
                <a href="mailto:lenient.fires_9q@icloud.com">lenient.fires_9q@icloud.com</a>
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
    let showLoadingOverlay = false;
    let loadingTimeout: ReturnType<typeof setTimeout> | null = null;
    let error: string | null = null;
    let result: DensityResult | null = null;
    let locationName: string | null = null;
    let currentProduct = 'ecmwf';
    let usedModel = 'ecmwf';
    let requestedForResult = 'ecmwf'; // What was requested for the current result (to detect true fallbacks)
    let lastUpdated: string = '';
    let forecastTimestamp: number = Date.now();
    let requestCounter = 0; // Prevents stale data from race conditions
    
    // Check if forecast time is within 5 minutes of actual current time
    $: isCurrentTime = Math.abs(forecastTimestamp - Date.now()) < 300000;
    let marker: L.CircleMarker | null = null;
    let centerMarker: L.CircleMarker | null = null;
    let trackingMode = true;
    let trackNow = false;
    let settingTimestampProgrammatically = false;
    let currentLocation: LatLon | null = null;
    let moveTimeout: ReturnType<typeof setTimeout> | null = null;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    let trackNowInterval: ReturnType<typeof setInterval> | null = null;
    
    // Available models for quick switching
    const QUICK_MODELS = [
        { id: 'ecmwf', label: 'ECMWF' },
        { id: 'gfs', label: 'GFS' },
        { id: 'icon', label: 'ICON' },
        { id: 'iconEu', label: 'ICON-EU' },
        { id: 'iconD2', label: 'ICON-D2' },
        { id: 'ukv', label: 'UKV' },
        { id: 'czeAladin', label: 'ALADIN' },
        { id: 'nems', label: 'NEMS' },
    ];
    const STORAGE_KEY = 'airDensity_lastModel';
    
    // Interpolate color along the gradient based on position (0-100)
    function getGradientColor(position: number): string {
        // Gradient: #ff9800 (0%) -> #4CAF50 (54%) -> #2196F3 (100%)
        const p = Math.max(0, Math.min(100, position)) / 100;
        
        if (p <= 0.54) {
            // Orange to green
            const t = p / 0.54;
            const r = Math.round(255 * (1 - t) + 76 * t);
            const g = Math.round(152 * (1 - t) + 175 * t);
            const b = Math.round(0 * (1 - t) + 80 * t);
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // Green to blue
            const t = (p - 0.54) / 0.46;
            const r = Math.round(76 * (1 - t) + 33 * t);
            const g = Math.round(175 * (1 - t) + 150 * t);
            const b = Math.round(80 * (1 - t) + 243 * t);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }
    
    function loadLastModel(): string {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'ecmwf';
        } catch {
            return 'ecmwf';
        }
    }
    
    function saveLastModel(model: string) {
        try {
            localStorage.setItem(STORAGE_KEY, model);
        } catch {
            // Ignore storage errors
        }
    }
    
    function formatForecastTime(timestamp: number): string {
        const date = new Date(timestamp);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const day = days[date.getDay()];
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        return `${day} ${h}:${m}`;
    }
    
    function setLoading(loading: boolean) {
        isLoading = loading;
        
        if (loading) {
            // Show overlay after 800ms delay
            if (loadingTimeout) clearTimeout(loadingTimeout);
            loadingTimeout = setTimeout(() => {
                showLoadingOverlay = true;
            }, 800);
        } else {
            // Clear pending timeout and hide overlay
            if (loadingTimeout) {
                clearTimeout(loadingTimeout);
                loadingTimeout = null;
            }
            showLoadingOverlay = false;
        }
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
        'iconWaves', 'gwam', 'ewam', 'efi', 'nems'
    ];
    
    const FORECAST_MODELS = [...GLOBAL_MODELS, ...REGIONAL_MODELS];
    
    function isForecastModel(product: string): boolean {
        return FORECAST_MODELS.includes(product);
    }
    
    function getModelForFetch(): string {
        const product = store.get('product') || 'ecmwf';
        return isForecastModel(product) ? product : 'ecmwf';
    }

    const MARKER_RADIUS = 12;
    
    /**
     * Place or update the click marker (circle marker for consistency)
     */
    function updateMarker(lat: number, lon: number) {
        if (marker) {
            marker.setLatLng([lat, lon]);
        } else {
            marker = L.circleMarker([lat, lon], {
                radius: MARKER_RADIUS,
                color: '#ff6600',
                weight: 3,
                fillColor: '#ff6600',
                fillOpacity: 0.3,
                className: 'density-click-marker'
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
                radius: MARKER_RADIUS,
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
        
        // Increment request counter to track this specific request
        const thisRequest = ++requestCounter;
        
        if (!silent) {
            setLoading(true);
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
            if (thisRequest === requestCounter) {
                locationName = locName;
            }
        }).catch(() => {
            if (thisRequest === requestCounter) {
                locationName = null;
            }
        });

        // Determine model
        const requestedModel = getModelForFetch();
        let actualUsedModel = requestedModel;
        let response: HttpPayload<WeatherDataPayload<DataHash>>;

        try {
            try {
                response = await getPointForecastData(requestedModel, latLon, name);
            } catch (fetchErr) {
                // Fallback to ecmwf for regional model failures
                if (requestedModel !== 'ecmwf' && !GLOBAL_MODELS.includes(requestedModel)) {
                    console.log(`[Air Density] ${requestedModel} failed, falling back to ecmwf`);
                    actualUsedModel = 'ecmwf';
                    response = await getPointForecastData('ecmwf', latLon, name);
                } else {
                    throw fetchErr;
                }
            }
            
            // Check if this request is still the latest
            if (thisRequest !== requestCounter) {
                return; // Abort - a newer request has been made
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
            let forecastTs = currentTs;
            
            for (let i = 0; i < timestamps.length; i++) {
                const diff = Math.abs(timestamps[i] - currentTs);
                if (diff < minDiff) {
                    minDiff = diff;
                    timeIndex = i;
                    forecastTs = timestamps[i];
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

            // Final check before updating state
            if (thisRequest !== requestCounter) {
                return; // Abort - a newer request has been made
            }

            requestedForResult = requestedModel;
            usedModel = actualUsedModel;
            result = {
                lat,
                lon,
                temp: tempCelsius,
                pressure: pressureHPa,
                humidity,
                density
            };
            
            lastUpdated = formatForecastTime(forecastTs);
            forecastTimestamp = forecastTs;

        } catch (err) {
            // Only update error state if this is still the latest request
            if (thisRequest === requestCounter) {
                console.error('Error calculating air density:', err);
                error = err instanceof Error ? err.message : 'Failed to fetch data';
                if (!silent) {
                    result = null;
                }
            }
        } finally {
            if (thisRequest === requestCounter) {
                setLoading(false);
            }
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


    function scheduleNextMinuteRefresh() {
        stopAutoRefresh();
        
        // Calculate ms until next minute boundary + 400ms cushion
        const now = new Date();
        const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 400;
        
        refreshTimeout = setTimeout(() => {
            if (currentLocation && !isLoading) {
                calculateDensity(currentLocation, true);
            }
            // Schedule the next one
            scheduleNextMinuteRefresh();
        }, msUntilNextMinute);
    }

    function startAutoRefresh() {
        scheduleNextMinuteRefresh();
    }

    function stopAutoRefresh() {
        if (refreshTimeout) {
            clearTimeout(refreshTimeout);
            refreshTimeout = null;
        }
    }
    
    function syncTimestampToNow() {
        settingTimestampProgrammatically = true;
        store.set('timestamp', Date.now());
        // Reset flag after a short delay to allow the store event to fire
        setTimeout(() => { settingTimestampProgrammatically = false; }, 100);
    }
    
    function onTrackNowChange() {
        if (trackNow) {
            // Sync immediately and start interval
            syncTimestampToNow();
            trackNowInterval = setInterval(syncTimestampToNow, 60000);
        } else {
            // Stop syncing
            if (trackNowInterval) {
                clearInterval(trackNowInterval);
                trackNowInterval = null;
            }
        }
    }
    
    function onTimestampChange() {
        // If user changed timestamp while trackNow is on, turn it off
        if (trackNow && !settingTimestampProgrammatically) {
            trackNow = false;
            if (trackNowInterval) {
                clearInterval(trackNowInterval);
                trackNowInterval = null;
            }
        }
        
        // Recalculate when time changes (request counter handles race conditions)
        if (currentLocation) {
            calculateDensity(currentLocation);
        } else if (trackingMode) {
            const center = map.getCenter();
            calculateDensity({ lat: center.lat, lon: center.lng });
        }
    }
    
    function onProductChange() {
        currentProduct = store.get('product') || 'ecmwf';
        saveLastModel(currentProduct);
        
        // Always recalculate when model changes (request counter handles race conditions)
        if (currentLocation) {
            calculateDensity(currentLocation);
        } else if (trackingMode) {
            // If no location yet but in tracking mode, use map center
            const center = map.getCenter();
            calculateDensity({ lat: center.lat, lon: center.lng });
        }
    }
    
    function selectModel(model: string) {
        if (model === currentProduct) {
            return; // Already selected
        }
        
        store.set('product', model);
        currentProduct = model;
        saveLastModel(model);
        
        // Directly trigger recalculation
        if (currentLocation) {
            calculateDensity(currentLocation);
        } else if (trackingMode) {
            const center = map.getCenter();
            calculateDensity({ lat: center.lat, lon: center.lng });
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
        // Register store listeners when plugin opens
        store.on('product', onProductChange);
        store.on('timestamp', onTimestampChange);
        
        currentProduct = store.get('product') || 'ecmwf';
        
        map.on('click', onMapClick);
        map.on('move', onMapMove);
        map.on('moveend', onMapMoveEnd);
        
        startAutoRefresh();
        
        // Restore last used model if available
        const lastModel = loadLastModel();
        if (lastModel && lastModel !== currentProduct) {
            store.set('product', lastModel);
        }
        
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
        // Component mounted - initial setup if needed
    });

    onDestroy(() => {
        map.off('click', onMapClick);
        map.off('move', onMapMove);
        map.off('moveend', onMapMoveEnd);
        store.off('product', onProductChange);
        store.off('timestamp', onTimestampChange);
        removeMarker();
        removeCenterMarker();
        stopAutoRefresh();
        if (moveTimeout) clearTimeout(moveTimeout);
        if (loadingTimeout) clearTimeout(loadingTimeout);
        if (trackNowInterval) clearInterval(trackNowInterval);
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
            
            .model-info {
                margin-bottom: 10px;
                padding-bottom: 8px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                
                .model-row {
                    display: flex;
                    gap: 6px;
                    font-size: 12px;
                    
                    &:not(:last-child) {
                        margin-bottom: 4px;
                    }
                    
                    .model-label {
                        color: rgba(255, 255, 255, 0.5);
                    }
                    
                    .model-value {
                        color: rgba(255, 255, 255, 0.9);
                        font-weight: 500;
                        
                        &.fallback {
                            color: #ff9800;
                        }
                        
                        .fallback-note {
                            font-weight: 400;
                            font-size: 10px;
                            opacity: 0.7;
                        }
                    }
                }
            }
            
            .model-chips {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                
                .model-chip {
                    padding: 4px 10px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    background: rgba(0, 0, 0, 0.2);
                    color: rgba(255, 255, 255, 0.7);
                    border-radius: 12px;
                    cursor: pointer;
                    font-size: 11px;
                    text-transform: uppercase;
                    transition: all 0.2s;
                    
                    &:hover {
                        background: rgba(255, 255, 255, 0.1);
                        color: white;
                    }
                    
                    &.active {
                        background: rgba(255, 102, 0, 0.3);
                        border-color: #ff6600;
                        color: white;
                    }
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
            
            .loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
                z-index: 10;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
                
                &.visible {
                    opacity: 1;
                    pointer-events: auto;
                }
                
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
                
                .time-info {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 4px;
                }
                
                .updated-at {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.5);
                }
                
                .track-now-label {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    cursor: pointer;
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.5);
                    
                    input[type="checkbox"] {
                        accent-color: #ff6600;
                        width: 12px;
                        height: 12px;
                        cursor: pointer;
                    }
                    
                    &:hover {
                        color: rgba(255, 255, 255, 0.8);
                    }
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
                        background: rgba(255, 255, 255, 0.8);
                    }
                    
                    &.current::before {
                        background: var(--marker-color, #4CAF50);
                        box-shadow: 0 0 6px var(--marker-color, rgba(76, 175, 80, 0.6));
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
                    
                    &.credit {
                        margin-top: 12px;
                        padding-top: 8px;
                        border-top: 1px solid rgba(255, 255, 255, 0.1);
                        font-size: 11px;
                        color: rgba(255, 255, 255, 0.6);
                        
                        a {
                            color: #ff6600;
                            text-decoration: none;
                            
                            &:hover {
                                text-decoration: underline;
                            }
                        }
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
