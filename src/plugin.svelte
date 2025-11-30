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

    <!-- Update Available Banner -->
    {#if updateAvailable}
        <div class="update-banner mb-15">
            <div class="update-header">🆕 v{latestVersion} available!</div>
            <p class="update-instructions">
                Copy the link below and paste it in <code>Load plugin directly from URL</code>:
            </p>
            <div class="update-url-box">
                <input 
                    type="text" 
                    readonly 
                    value={updatePluginUrl}
                    class="update-url-input"
                    on:click={(e) => e.currentTarget.select()}
                />
                <button class="copy-btn" on:click={copyUpdateUrl} title="Copy URL">
                    {#if copySuccess}
                        <span class="copy-icon">✓</span>
                    {:else}
                        <span class="copy-icon">📋</span>
                    {/if}
                </button>
            </div>
            <button 
                class="plugins-panel-link"
                on:click={openPluginsPanel}
            >
                Open Windy Plugins Panel
            </button>
        </div>
    {/if}

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
                        <span>Now</span>
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

            <div class="density-result" style="background: {getGradientBg(getDensityPosition(result.density), 0.25)}">
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
            <div class="empty-icon">⊕</div>
            <div class="empty-text">
                Pan the map to measure air density
            </div>
        </div>
    {/if}

    <!-- Mode Toggle -->
    <div class="mode-toggle mb-15">
        <div class="save-preset-row">
            {#each [1, 2, 3, 4] as presetNum}
                <div class="preset-actions">
                    <button 
                        class="save-preset-btn"
                        disabled={isPresetSameAsCurrent(presetNum)}
                        on:click={() => saveToPreset(presetNum)}
                        on:mouseenter={() => hoveredSavePreset = presetNum}
                        on:mouseleave={() => hoveredSavePreset = null}
                        title="Save current location to preset {presetNum}"
                    >
                        💾 {presetNum}
                    </button>
                    <button 
                        class="delete-preset-btn"
                        disabled={presetLocations[presetNum] === null}
                        on:click={() => deletePreset(presetNum)}
                        on:mouseenter={() => hoveredDeletePreset = presetNum}
                        on:mouseleave={() => hoveredDeletePreset = null}
                        title="Delete preset {presetNum}"
                    >
                        🗑️ {presetNum}
                    </button>
                </div>
            {/each}
        </div>
        
        <div class="mode-row">
            <button 
                class="mode-btn" 
                class:active={trackingMode}
                on:click={() => setTrackingMode(true)}
            >
                ⊕ Map Center
            </button>
            <button
                class="mode-btn"
                class:active={!trackingMode && activePreset === null}
                on:click={() => { activePreset = null; saveActivePreset(null); setTrackingMode(false); }}
            >
                📍 Pick from Map
            </button>
        </div>
        
        <div class="preset-buttons-container">
            <div class="loading-overlay" class:visible={showPresetsLoadingOverlay}>
                <div class="spinner"></div>
            </div>
            <div class="preset-buttons">
                {#each [1, 2, 3, 4] as presetNum}
                    {@const preset = presetLocations[presetNum]}
                    {#if preset}
                        {@const pos = preset.density ? getDensityPosition(preset.density) : 0}
                        {@const bgColor = preset.density ? getGradientBg(pos, 0.3) : null}
                        <button 
                            class="preset-btn" 
                            class:active={!trackingMode && activePreset === presetNum}
                            class:save-target={hoveredSavePreset === presetNum}
                            class:delete-target={hoveredDeletePreset === presetNum}
                            on:click={() => selectPreset(presetNum)}
                            title={preset.name || 'Location'}
                            style={bgColor ? `background: ${bgColor}` : ''}
                        >
                            <span class="preset-name">{preset.name || 'Location'}</span>
                            <span class="preset-density">{preset.density?.toFixed(4) || '—'}</span>
                            <span class="preset-index">{presetNum}</span>
                        </button>
                    {/if}
                {/each}
            </div>
        </div>
    </div>

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
    
    const VERSION_CHECK_URL = 'https://raw.githubusercontent.com/Marvosg/windy-plugin-air-density/refs/heads/main/src/pluginConfig.ts';

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
        density?: number | null;
    }

    // State
    let isLoading = false;
    let showLoadingOverlay = false;
    let loadingTimeout: ReturnType<typeof setTimeout> | null = null;
    let showPresetsLoadingOverlay = false;
    let presetsLoadingTimeout: ReturnType<typeof setTimeout> | null = null;
    let error: string | null = null;
    let result: DensityResult | null = null;
    let locationName: string | null = null;
    let currentProduct = 'ecmwf';
    let usedModel = 'ecmwf';
    let requestedForResult = 'ecmwf'; // What was requested for the current result (to detect true fallbacks)
    let lastUpdated: string = '';
    let forecastTimestamp: number = Date.now();
    let previousForecastTimestamp: number = Date.now();
    let requestCounter = 0; // Prevents stale data from race conditions
    
    // Check if forecast time is within 1 hour of actual current time
    $: isCurrentTime = Math.abs(forecastTimestamp - Date.now()) < 3600000;
    let marker: L.CircleMarker | null = null;
    let centerMarker: L.CircleMarker | null = null;
    let trackingMode = true;

    // ---------- Active preset persistence ----------
    function loadActivePreset(): number | null {
        try {
            const v = localStorage.getItem(STORAGE_KEY_ACTIVE_PRESET);
            if (v === null) return null;
            const n = Number(v);
            return Number.isFinite(n) && n >= 1 && n <= 4 ? n : null;
        } catch {
            return null;
        }
    }

    function saveActivePreset(num: number | null) {
        try {
            if (num === null) {
                localStorage.removeItem(STORAGE_KEY_ACTIVE_PRESET);
            } else {
                localStorage.setItem(STORAGE_KEY_ACTIVE_PRESET, String(num));
            }
        } catch { /* ignore */ }
    }

    function loadTrackCenter(): boolean {
        try {
            return localStorage.getItem(STORAGE_KEY_TRACK_CENTER) !== 'false';
        } catch { return true; }
    }

    function saveTrackCenter(enabled: boolean) {
        try { localStorage.setItem(STORAGE_KEY_TRACK_CENTER, String(enabled)); } catch {}
    }

    // Initialize
    trackingMode = loadTrackCenter();
    let trackNow = false;
    let updateAvailable = false;
    let latestVersion = '';
    let copySuccess = false;
    
    // Build plugin URL with latest version
    $: updatePluginUrl = `https://windy-plugins.com/1805937/windy-plugin-air-density/${latestVersion}/plugin.min.js`;
    
    async function copyUpdateUrl() {
        try {
            await navigator.clipboard.writeText(updatePluginUrl);
            copySuccess = true;
            setTimeout(() => {
                copySuccess = false;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }
    
    function openPluginsPanel() {
        const baseUrl = 'https://www.windy.com/plugins';
        const params = window.location.search;
        window.location.href = params ? `${baseUrl}${params}` : baseUrl;
    }
    let currentLocation: LatLon | null = null;
    let moveTimeout: ReturnType<typeof setTimeout> | null = null;
    let moveInterval: ReturnType<typeof setInterval> | null = null;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    let trackNowInterval: ReturnType<typeof setInterval> | null = null;
    let hoveredSavePreset: number | null = null;
    let hoveredDeletePreset: number | null = null;
    
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
    const STORAGE_KEY_TRACK_NOW = 'airDensity_trackNow';
    const STORAGE_KEY_PRESETS = 'airDensity_presets';
    // Remember whether we are following map center (true) or picking manually (false)
    const STORAGE_KEY_TRACK_CENTER = 'airDensity_trackCenter';
    const STORAGE_KEY_ACTIVE_PRESET = 'airDensity_activePreset';
    // Key used to mark that the plugin has completed its first-launch initialization
    const STORAGE_KEY_INITIALIZED = 'airDensity_initialized';
    
    interface PresetLocation {
        lat: number;
        lon: number;
        name: string | null;
        density: number | null;
    }
    
    let activePreset: number | null = null;
    let presetLocations: { [key: number]: PresetLocation | null } = {
        1: null, 2: null, 3: null, 4: null
    };
    
    // Convert density value to position on the gradient (0-100)
    function getDensityPosition(density: number): number {
        return Math.max(0, Math.min(100, ((density - DENSITY_MIN) / (DENSITY_MAX - DENSITY_MIN)) * 100));
    }
    
    // Get RGB components for a position on the gradient (0-100)
    function getGradientRGB(position: number): [number, number, number] {
        // Gradient: #ff9800 (0%) -> #4CAF50 (54%) -> #2196F3 (100%)
        const p = Math.max(0, Math.min(100, position)) / 100;
        
        if (p <= 0.54) {
            // Orange to green
            const t = p / 0.54;
            return [
                Math.round(255 * (1 - t) + 76 * t),
                Math.round(152 * (1 - t) + 175 * t),
                Math.round(0 * (1 - t) + 80 * t)
            ];
        } else {
            // Green to blue
            const t = (p - 0.54) / 0.46;
            return [
                Math.round(76 * (1 - t) + 33 * t),
                Math.round(175 * (1 - t) + 150 * t),
                Math.round(80 * (1 - t) + 243 * t)
            ];
        }
    }
    
    // Interpolate color along the gradient based on position (0-100)
    function getGradientColor(position: number): string {
        const [r, g, b] = getGradientRGB(position);
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    // Get gradient color with alpha for backgrounds
    function getGradientBg(position: number, alpha: number = 0.25): string {
        const [r, g, b] = getGradientRGB(position);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    
    function loadTrackNow(): boolean {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_TRACK_NOW);
            // Enable by default if not stored yet
            return stored === null ? true : stored === 'true';
        } catch {
            return true;
        }
    }
    
    function saveTrackNow(enabled: boolean) {
        try {
            localStorage.setItem(STORAGE_KEY_TRACK_NOW, String(enabled));
        } catch {
            // Ignore storage errors
        }
    }
    
    function loadPresets(): { [key: number]: PresetLocation | null } {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_PRESETS);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Ensure we only have 4 presets
                return { 1: parsed[1] || null, 2: parsed[2] || null, 3: parsed[3] || null, 4: parsed[4] || null };
            }
        } catch {
            // Ignore storage errors
        }
        return { 1: null, 2: null, 3: null, 4: null };
    }
    
    function savePresets() {
        try {
            // Strip density before persisting to avoid stale values
            const sanitized: { [key: number]: Omit<PresetLocation, 'density'> | null } = { 1: null, 2: null, 3: null, 4: null };
            for (const num of [1,2,3,4] as const) {
                const p = presetLocations[num];
                if (p) {
                    const { lat, lon, name } = p;
                    sanitized[num] = { lat, lon, name };
                }
            }
            localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(sanitized));
        } catch {
            // Ignore storage errors
        }
    }
    
    function isPresetSameAsCurrent(num: number): boolean {
        const preset = presetLocations[num];
        if (!preset || !currentLocation) {
            return false;
        }
        // Consider same if within ~100m
        const latDiff = Math.abs(preset.lat - currentLocation.lat);
        const lonDiff = Math.abs(preset.lon - currentLocation.lon);
        return latDiff < 0.001 && lonDiff < 0.001;
    }
    
    function saveToPreset(num: number) {
        if (!currentLocation) {
            return;
        }
        
        presetLocations[num] = {
            lat: currentLocation.lat,
            lon: currentLocation.lon,
            name: locationName,
            density: result?.density || null
        };
        presetLocations = presetLocations; // Trigger reactivity
        savePresets();
    }
    
    function deletePreset(num: number) {
        presetLocations[num] = null;
        presetLocations = presetLocations; // Trigger reactivity
        savePresets();
        
        // If the deleted preset was active, switch to tracking mode
        if (activePreset === num) {
            setTrackingMode(true);
        }
    }
    
    function selectPreset(num: number) {
        const preset = presetLocations[num];
        if (!preset) {
            // No saved location - do nothing
            return;
        }
        
        // Switch to this preset and load its location
        trackingMode = false;
        saveTrackCenter(false);
        activePreset = num;
        saveActivePreset(num);
        removeCenterMarker();
        
        map.setView([preset.lat, preset.lon], map.getZoom());
        calculateDensity({ lat: preset.lat, lon: preset.lon });
    }
    
    function setPresetsLoading(loading: boolean) {
        if (loading) {
            // Show overlay after 800ms delay
            if (presetsLoadingTimeout) clearTimeout(presetsLoadingTimeout);
            presetsLoadingTimeout = setTimeout(() => {
                showPresetsLoadingOverlay = true;
            }, 800);
        } else {
            // Clear pending timeout and hide overlay
            if (presetsLoadingTimeout) {
                clearTimeout(presetsLoadingTimeout);
                presetsLoadingTimeout = null;
            }
            showPresetsLoadingOverlay = false;
        }
    }
    
    /**
     * Update density values for all preset locations
     * Called when model or time changes, and on auto-refresh
     */
    async function updatePresetDensities() {
        const presetNums = [1, 2, 3, 4] as const;
        
        // Check if any presets exist
        const hasPresets = presetNums.some(num => presetLocations[num] !== null);
        if (!hasPresets) {
            return;
        }
        
        setPresetsLoading(true);
        
        try {
            for (const num of presetNums) {
                const preset = presetLocations[num];
                if (!preset) {
                    continue;
                }
                
                try {
                    const requestedModel = getModelForFetch();
                    let response;
                    
                    try {
                        response = await getPointForecastData(requestedModel, { lat: preset.lat, lon: preset.lon }, name);
                    } catch {
                        // Fallback to ecmwf
                        if (requestedModel !== 'ecmwf' && !GLOBAL_MODELS.includes(requestedModel)) {
                            response = await getPointForecastData('ecmwf', { lat: preset.lat, lon: preset.lon }, name);
                        } else {
                            continue; // Skip this preset on error
                        }
                    }
                    
                    if (!response?.data?.data) {
                        continue;
                    }
                    
                    const weatherData = response.data.data;
                    const currentTs = store.get('timestamp') || Date.now();
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
                    
                    const tempValue = weatherData['temp-surface']?.[timeIndex] ?? weatherData.temp?.[timeIndex];
                    const pressureValue = weatherData.pressure?.[timeIndex] ?? weatherData['sea_level_pressure']?.[timeIndex] ?? weatherData.slp?.[timeIndex];
                    const humidityValue = weatherData['rh-surface']?.[timeIndex] ?? weatherData.rh?.[timeIndex];
                    
                    if (tempValue === undefined || pressureValue === undefined) {
                        continue;
                    }
                    
                    const tempCelsius = tempValue > 200 ? tempValue - 273.15 : tempValue;
                    const pressureHPa = pressureValue > 10000 ? pressureValue / 100 : pressureValue;
                    const humidity = humidityValue ?? 50;
                    
                    const density = calculateAirDensity(tempCelsius, pressureHPa, humidity);
                    
                    presetLocations[num] = { ...preset, density };
                } catch {
                    // Silently skip failed presets
                }
            }
            
            presetLocations = presetLocations; // Trigger reactivity
        } finally {
            setPresetsLoading(false);
        }
    }
    
    function compareVersions(current: string, latest: string): boolean {
        const currentParts = current.split('.').map(Number);
        const latestParts = latest.split('.').map(Number);
        
        for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
            const c = currentParts[i] || 0;
            const l = latestParts[i] || 0;
            if (l > c) return true;
            if (l < c) return false;
        }
        return false;
    }
    
    async function checkForUpdates() {
        try {
            const response = await fetch(VERSION_CHECK_URL);
            if (!response.ok) return;
            
            const text = await response.text();
            // Parse version from the TypeScript file
            const versionMatch = text.match(/version:\s*['"]([^'"]+)['"]/);
            if (versionMatch && versionMatch[1]) {
                const remoteVersion = versionMatch[1];
                if (compareVersions(config.version, remoteVersion)) {
                    latestVersion = remoteVersion;
                    updateAvailable = true;
                }
            }
        } catch (err) {
            // Silently fail - version check is not critical
            console.log('[Air Density] Version check failed:', err);
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
            previousForecastTimestamp = forecastTimestamp;
            forecastTimestamp = forecastTs;
            
            // If trackNow is on but forecast time changed significantly (> 1 hour), turn it off
            // BUT only if the new time is NOT close to "now" (user intentionally selected a different time)
            // If new time IS close to now, user just clicked "current time" to sync back
            const newTimeIsNow = Math.abs(forecastTimestamp - Date.now()) < 3600000;
            if (trackNow && Math.abs(forecastTimestamp - previousForecastTimestamp) > 3600000 && !newTimeIsNow) {
                trackNow = false;
                saveTrackNow(false);
                if (trackNowInterval) {
                    clearInterval(trackNowInterval);
                    trackNowInterval = null;
                }
            }

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
            // Deselect preset when clicking on map (different location)
            activePreset = null;
            saveActivePreset(null);
            calculateDensity({ lat: e.latlng.lat, lon: e.latlng.lng });
        }
    }

    function onMapMove() {
        if (trackingMode) {
            updateCenterMarker();
            
            // Start interval to recalculate every 1 second while moving
            if (!moveInterval) {
                moveInterval = setInterval(() => {
                    const center = map.getCenter();
                    calculateDensity({ lat: center.lat, lon: center.lng }, true);
                }, 1000);
            }
        }
    }

    function onMapMoveEnd() {
        if (trackingMode) {
            // Stop the move interval
            if (moveInterval) {
                clearInterval(moveInterval);
                moveInterval = null;
            }
            
            // Calculate immediately
            const center = map.getCenter();
            calculateDensity({ lat: center.lat, lon: center.lng });
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
            // Update preset densities on auto-refresh
            updatePresetDensities();
            // Schedule the next one
            scheduleNextMinuteRefresh();
        }, msUntilNextMinute);
    }

    function startAutoRefresh() {
        scheduleNextMinuteRefresh();
    }

    /**
     * Trigger an immediate density refresh (used when tab regains focus)
     */
    function refreshNow() {
        if (isLoading) return;
        if (trackNow) {
            syncTimestampToNow();
        }

        if (currentLocation) {
            calculateDensity(currentLocation, true);
        } else if (trackingMode) {
            const center = map.getCenter();
            calculateDensity({ lat: center.lat, lon: center.lng }, true);
        }
        updatePresetDensities();
        // Restart auto-refresh timer from the upcoming minute boundary
        scheduleNextMinuteRefresh();
    }

    function stopAutoRefresh() {
        if (refreshTimeout) {
            clearTimeout(refreshTimeout);
            refreshTimeout = null;
        }
    }
    
    function syncTimestampToNow() {
        store.set('timestamp', Date.now());
    }
    
    function onTrackNowChange() {
        saveTrackNow(trackNow);
        
        if (trackNow) {
            // Remember current forecast timestamp so that the first automatic
            // update triggered right after enabling "Now" does not wrongly
            // interpret the large jump as a user-initiated change and disable
            // tracking again (see logic in calculateDensity).
            previousForecastTimestamp = forecastTimestamp;

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
        // Recalculation will happen, and we'll check if forecast time actually changed there
        
        // Recalculate when time changes (request counter handles race conditions)
        if (currentLocation) {
            calculateDensity(currentLocation);
        } else if (trackingMode) {
            const center = map.getCenter();
            calculateDensity({ lat: center.lat, lon: center.lng });
        }
        
        // Update preset densities for new time
        updatePresetDensities();
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
        
        // Update preset densities for new model
        updatePresetDensities();
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
        saveTrackCenter(enabled);
        if (enabled) {
            saveActivePreset(null);
        }
        
        if (enabled) {
            activePreset = null;
            removeMarker();
            updateCenterMarker();
            const center = map.getCenter();
            calculateDensity({ lat: center.lat, lon: center.lng });
        } else {
            removeCenterMarker();
        }
    }

    // Handler to refresh when tab becomes visible
    function onVisibilityChange() {
        if (document.visibilityState === 'visible') {
            refreshNow();
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

        // Refresh when page/tab becomes visible again
        window.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', refreshNow);
        
        startAutoRefresh();
        
        // Restore last used model if available
        const lastModel = loadLastModel();
        if (lastModel && lastModel !== currentProduct) {
            store.set('product', lastModel);
        }
        
        // Ensure default preset is created on first launch
        try {
            if (!localStorage.getItem(STORAGE_KEY_INITIALIZED)) {
                // Save Maribor preset as first slot (46.4825°, 15.6878°)
                const defaultPresets = {
                    1: {
                        lat: 46.4825,
                        lon: 15.6878,
                        name: 'LCM',
                        density: null,
                    },
                    2: null,
                    3: null,
                    4: null,
                } as { [key: number]: PresetLocation | null };
                localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(defaultPresets));
                localStorage.setItem(STORAGE_KEY_INITIALIZED, 'true');
                localStorage.setItem(STORAGE_KEY_TRACK_CENTER, 'false');

                // Immediately make preset 1 active
                trackingMode = false;
                activePreset = 1;
                saveTrackCenter(false);
                saveActivePreset(1);
            }
        } catch {
            // ignore storage errors
        }

        presetLocations = loadPresets();

        // Immediately fetch densities for existing presets (including default LCM)
        updatePresetDensities();

        // Restore previously selected preset if any
        const storedActive = loadActivePreset();
        if (storedActive && presetLocations[storedActive]) {
            selectPreset(storedActive);
        }
        
        // Restore track now setting
        trackNow = loadTrackNow();
        if (trackNow) {
            syncTimestampToNow();
            trackNowInterval = setInterval(syncTimestampToNow, 60000);
        }
        
        if (params && params.lat !== undefined && params.lon !== undefined) {
            trackingMode = false;
            calculateDensity(params);
        } else if (trackingMode) {
            updateCenterMarker();
            const center = map.getCenter();
            calculateDensity({ lat: center.lat, lon: center.lng });
        }
        
        // Check for updates (async, non-blocking)
        checkForUpdates();
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
        if (moveInterval) clearInterval(moveInterval);
        if (loadingTimeout) clearTimeout(loadingTimeout);
        if (presetsLoadingTimeout) clearTimeout(presetsLoadingTimeout);
        if (trackNowInterval) clearInterval(trackNowInterval);

        window.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('focus', refreshNow);
    });
</script>

<style lang="less">
    .density-plugin {
        .update-banner {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            padding: 0.75rem;
            background: linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(33, 150, 243, 0.2));
            border: 1px solid rgba(76, 175, 80, 0.4);
            border-radius: 0.375rem;
            
            .update-header {
                font-size: 1rem;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.95);
            }
            
            .update-instructions {
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.7);
                margin: 0;
                line-height: 1.4;
                
                code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 0.125rem 0.375rem;
                    border-radius: 0.1875rem;
                    font-family: monospace;
                    font-size: 0.625rem;
                    color: rgba(255, 255, 255, 0.9);
                }
            }
            
            .update-url-box {
                display: flex;
                align-items: stretch;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 0.25rem;
                overflow: hidden;
                
                .update-url-input {
                    flex: 1;
                    padding: 0.375rem 0.625rem;
                    background: transparent;
                    border: none;
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 0.875rem;
                    font-family: monospace;
                    outline: none;
                    min-width: 0;
                    
                    &:focus {
                        background: rgba(255, 255, 255, 0.05);
                    }
                }
                
                .copy-btn {
                    padding: 0.375rem 0.625rem;
                    background: rgba(76, 175, 80, 0.3);
                    border: none;
                    border-left: 1px solid rgba(255, 255, 255, 0.1);
                    cursor: pointer;
                    transition: background 0.2s;
                    
                    &:hover {
                        background: rgba(76, 175, 80, 0.5);
                    }
                    
                    .copy-icon {
                        font-size: 0.875rem;
                        color: white;
                    }
                }
            }
            
            .plugins-panel-link {
                display: block;
                width: 100%;
                text-align: center;
                padding: 0.5rem 0.75rem;
                background: rgba(76, 175, 80, 0.3);
                border: 1px solid rgba(76, 175, 80, 0.5);
                border-radius: 0.25rem;
                color: #81c784;
                font-size: 0.875rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                
                &:hover {
                    background: rgba(76, 175, 80, 0.5);
                    color: white;
                }
            }
        }
        
        .mode-toggle {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;

            .mode-row {
                display: flex;
                gap: 0.5rem;

                .mode-btn {
                    flex: 1 1 0;
                }
            }
            
            .mode-btn {
                padding: 0.5rem 0.75rem;
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: rgba(0, 0, 0, 0.2);
                color: rgba(255, 255, 255, 0.7);
                border-radius: 0.375rem;
                cursor: pointer;
                font-size: 1rem;
                transition: all 0.2s;
                
                &:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                
                &.active {
                    background: rgba(255, 102, 0, 0.3);
                    border-color: #ff6600;
                    color: white;
                }
                
                &--full {
                    width: 100%;
                }
            }
            
            .save-preset-row {
                display: flex;
                gap: 0.375rem;
                margin-bottom: 0.25rem;
                
                .preset-actions {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }
                
                .save-preset-btn,
                .delete-preset-btn {
                    width: 100%;
                    padding: 0.375rem 0.5rem;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    background: rgba(0, 0, 0, 0.15);
                    color: rgba(255, 255, 255, 0.6);
                    border-radius: 0.25rem;
                    cursor: pointer;
                    font-size: 0.875rem;
                    transition: all 0.2s;
                    
                    &:disabled {
                        opacity: 0.3;
                        cursor: not-allowed;
                    }
                }
                
                .save-preset-btn {
                    &:hover:not(:disabled) {
                        background: rgba(76, 175, 80, 0.2);
                        border-color: rgba(76, 175, 80, 0.4);
                        color: #81c784;
                    }
                }
                
                .delete-preset-btn {
                    padding: 0.25rem 0.5rem;
                    font-size: 0.75rem;
                    
                    &:hover:not(:disabled) {
                        background: rgba(255, 82, 82, 0.2);
                        border-color: rgba(255, 82, 82, 0.4);
                        color: #ff5252;
                    }
                }
            }
            
            .preset-buttons-container {
                position: relative;
                
                > .loading-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 0.375rem;
                    z-index: 10;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.3s ease;
                    
                    &.visible {
                        opacity: 1;
                        pointer-events: auto;
                    }
                    
                    .spinner {
                        width: 1.25rem;
                        height: 1.25rem;
                        border: 0.1875rem solid rgba(255, 255, 255, 0.3);
                        border-top-color: #ff6600;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                }
            }
            
            .preset-buttons {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 0.375rem;
                
                .preset-btn {
                    position: relative;
                    padding: 0.625rem 0.5rem;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    background: rgba(0, 0, 0, 0.2);
                    color: rgba(255, 255, 255, 0.5);
                    border-radius: 0.375rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.125rem;
                    min-height: 3.125rem;
                    justify-content: center;
                    min-width: 0; // Allow shrinking for text ellipsis
                    
                    &:hover {
                        background: rgba(255, 255, 255, 0.1);
                        color: rgba(255, 255, 255, 0.8);
                    }
                    
                    &.has-location {
                        color: rgba(255, 255, 255, 0.95);
                    }
                    
                    &.active {
                        border-color: white;
                        box-shadow: 0 0 0 1px white;
                    }
                    
                    &.save-target {
                        outline: 3px solid #81c784;
                        outline-offset: -1px;
                    }
                    
                    &.delete-target {
                        outline: 3px solid #ff5252;
                        outline-offset: -1px;
                    }
                    
                    .preset-name {
                        font-size: 0.875rem;
                        font-weight: 500;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        width: 100%;
                        text-align: center;
                    }
                    
                    .preset-density {
                        font-size: 1rem;
                        font-weight: 700;
                        color: white;
                    }
                    
                    .preset-index {
                        position: absolute;
                        bottom: 0.25rem;
                        right: 0.375rem;
                        font-size: 0.625rem;
                        opacity: 0.4;
                        font-weight: 500;
                    }
                    
                    &:not(.has-location) {
                        cursor: default;
                        
                        &:hover {
                            background: rgba(0, 0, 0, 0.2);
                            color: rgba(255, 255, 255, 0.5);
                        }
                    }
                }
            }
        }

        .settings-panel {
            background: rgba(0, 0, 0, 0.2);
            padding: 0.625rem 0.9375rem;
            
            .model-info {
                margin-bottom: 0.625rem;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                
                .model-row {
                    display: flex;
                    gap: 0.375rem;
                    font-size: 0.875rem;
                    
                    &:not(:last-child) {
                        margin-bottom: 0.25rem;
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
                            font-size: 0.625rem;
                            opacity: 0.7;
                        }
                    }
                }
            }
            
            .model-chips {
                display: flex;
                flex-wrap: wrap;
                gap: 0.375rem;
                
                .model-chip {
                    padding: 0.25rem 0.625rem;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    background: rgba(0, 0, 0, 0.2);
                    color: rgba(255, 255, 255, 0.7);
                    border-radius: 0.75rem;
                    cursor: pointer;
                    font-size: 0.875rem;
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
            padding: 0.625rem 0.9375rem;
            border-radius: 0.375rem;
            color: #ff6b6b;
            font-size: 1rem;
        }

        .result-panel {
            background: rgba(0, 0, 0, 0.25);
            padding: 0.9375rem;
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
                border-radius: 0.375rem;
                z-index: 10;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
                
                &.visible {
                    opacity: 1;
                    pointer-events: auto;
                }
                
                .spinner {
                    width: 1.5rem;
                    height: 1.5rem;
                    border: 0.1875rem solid rgba(255, 255, 255, 0.3);
                    border-top-color: #ff6600;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
            }
            
            .result-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 0.75rem;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                
                .location-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.125rem;
                    min-width: 0; // Allow text to truncate
                    flex: 1;
                }
                
                .location-name {
                    font-weight: 600;
                    font-size: 1rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                    padding-right: 0.5rem;
                }
                
                .coordinates {
                    font-size: 0.875rem;
                    color: rgba(255, 255, 255, 0.5);
                }
                
                .time-info {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 0.25rem;
                }
                
                .updated-at {
                    font-size: 1rem;
                    font-weight: 600;
                    color: white;
                    min-width: max-content;
                }
                
                .track-now-label {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    cursor: pointer;
                    font-size: 0.625rem;
                    color: rgba(255, 255, 255, 0.5);
                    
                    input[type="checkbox"] {
                        accent-color: #ff6600;
                        width: 0.75rem;
                        height: 0.75rem;
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
                gap: 0.5rem;
                margin-bottom: 0.75rem;
                
                .result-item {
                    text-align: center;
                    padding: 0.5rem;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 0.375rem;
                    min-width: 0;
                    
                    .result-label {
                        display: block;
                        font-size: 0.625rem;
                        color: rgba(255, 255, 255, 0.6);
                        margin-bottom: 0.1875rem;
                    }
                    
                    .result-value {
                        display: block;
                        font-size: 0.875rem;
                        font-weight: 600;
                        color: rgba(255, 255, 255, 0.7);
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                }
            }
            
            .density-result {
                text-align: center;
                padding: 0.75rem;
                border-radius: 0.5rem;
                margin-bottom: 0.5rem;
                
                .density-label {
                    display: block;
                    font-size: 0.875rem;
                    color: rgba(255, 255, 255, 0.7);
                    margin-bottom: 0.25rem;
                }
                
                .density-value {
                    display: block;
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: white;
                }
                
                .density-unit {
                    font-size: 1rem;
                    color: rgba(255, 255, 255, 0.7);
                }
            }
            
            .density-context {
                text-align: center;
                
                .context-tag {
                    display: inline-block;
                    padding: 0.1875rem 0.625rem;
                    border-radius: 0.625rem;
                    font-size: 0.875rem;
                    
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
            padding: 0.75rem;
            
            .comparison-title {
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.7);
                margin-bottom: 0.625rem;
            }
            
            .bar-track {
                position: relative;
                height: 0.5rem;
                background: linear-gradient(to right, #ff9800, #4CAF50, #2196F3);
                border-radius: 0.25rem;
                margin-bottom: 1.375rem;
                
                .bar-marker {
                    position: absolute;
                    top: -0.25rem;
                    transform: translateX(-50%);
                    
                    &::before {
                        content: '';
                        display: block;
                        width: 0.875rem;
                        height: 0.875rem;
                        border-radius: 50%;
                        border: 0.125rem solid white;
                    }
                    
                    .marker-label {
                        position: absolute;
                        top: 1.125rem;
                        left: 50%;
                        transform: translateX(-50%);
                        font-size: 0.5625rem;
                        white-space: nowrap;
                    }
                    
                    &.standard::before {
                        background: white;
                    }
                    
                    &.current::before {
                        background: var(--marker-color, #4CAF50);
                        box-shadow: 0 0 0.375rem var(--marker-color, rgba(76, 175, 80, 0.6));
                    }
                }
            }
            
            .bar-labels {
                display: flex;
                justify-content: space-between;
                font-size: 0.625rem;
                color: rgba(255, 255, 255, 0.5);
            }
            
            .comparison-diff {
                margin-top: 0.5rem;
                text-align: center;
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.8);
            }
        }

        .empty-state {
            text-align: center;
            padding: 1.875rem 1.25rem;
            background: rgba(0, 0, 0, 0.15);
            
            .empty-icon {
                font-size: 2.5rem;
                margin-bottom: 0.625rem;
            }
            
            .empty-text {
                color: rgba(255, 255, 255, 0.7);
                font-size: 1rem;
            }
        }

        .info-section {
            padding: 0.75rem;
            font-size: 0.875rem;
            
            details {
                summary {
                    cursor: pointer;
                    font-weight: 500;
                    
                    &:hover {
                        color: #ff6600;
                    }
                }
                
                p {
                    margin: 0.5rem 0;
                    line-height: 1.4;
                    color: rgba(255, 255, 255, 0.8);
                    
                    &.note {
                        font-size: 0.875rem;
                        color: rgba(255, 255, 255, 0.6);
                        font-style: italic;
                    }
                    
                    &.credit {
                        margin-top: 0.75rem;
                        padding-top: 0.5rem;
                        border-top: 1px solid rgba(255, 255, 255, 0.1);
                        font-size: 0.875rem;
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
        margin-bottom: 0.9375rem;
    }

    .rounded-box {
        border-radius: 0.375rem;
    }

    .bg-secondary {
        background: rgba(255, 255, 255, 0.05);
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }
</style>
