/**
 * Color Scale Module
 * 
 * Provides color mapping for air density visualization using
 * a perceptually uniform color scale inspired by scientific visualization.
 */

export interface RGB {
    r: number;
    g: number;
    b: number;
}

export interface ColorStop {
    position: number;  // 0-1
    color: RGB;
}

/**
 * Viridis-inspired color scale - perceptually uniform, colorblind-friendly
 * Goes from dark purple (low density) to yellow (high density)
 */
const VIRIDIS_SCALE: ColorStop[] = [
    { position: 0.0, color: { r: 68, g: 1, b: 84 } },      // Dark purple (low)
    { position: 0.25, color: { r: 59, g: 82, b: 139 } },   // Blue
    { position: 0.5, color: { r: 33, g: 145, b: 140 } },   // Teal
    { position: 0.75, color: { r: 94, g: 201, b: 98 } },   // Green
    { position: 1.0, color: { r: 253, g: 231, b: 37 } }    // Yellow (high)
];

/**
 * Alternative thermal scale - intuitive hot/cold representation
 * Blue (cold/dense) to Red (hot/less dense)
 */
const THERMAL_SCALE: ColorStop[] = [
    { position: 0.0, color: { r: 0, g: 0, b: 139 } },      // Dark blue (low density = hot)
    { position: 0.25, color: { r: 0, g: 191, b: 255 } },   // Deep sky blue
    { position: 0.5, color: { r: 144, g: 238, b: 144 } },  // Light green
    { position: 0.75, color: { r: 255, g: 165, b: 0 } },   // Orange
    { position: 1.0, color: { r: 178, g: 34, b: 34 } }     // Firebrick (high density = cold)
];

/**
 * Density-optimized scale - emphasizes variations around standard density
 */
const DENSITY_SCALE: ColorStop[] = [
    { position: 0.0, color: { r: 158, g: 1, b: 66 } },     // Deep magenta (very low)
    { position: 0.2, color: { r: 213, g: 62, b: 79 } },    // Red-pink
    { position: 0.4, color: { r: 253, g: 174, b: 97 } },   // Orange
    { position: 0.5, color: { r: 255, g: 255, b: 191 } },  // Pale yellow (standard ~1.225)
    { position: 0.6, color: { r: 171, g: 221, b: 164 } },  // Light green
    { position: 0.8, color: { r: 43, g: 131, b: 186 } },   // Blue
    { position: 1.0, color: { r: 94, g: 79, b: 162 } }     // Purple (very high)
];

export type ColorScaleType = 'viridis' | 'thermal' | 'density';

const SCALES: Record<ColorScaleType, ColorStop[]> = {
    viridis: VIRIDIS_SCALE,
    thermal: THERMAL_SCALE,
    density: DENSITY_SCALE
};

/**
 * Linear interpolation between two values
 */
function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * Interpolate between two colors
 */
function interpolateColor(c1: RGB, c2: RGB, t: number): RGB {
    return {
        r: Math.round(lerp(c1.r, c2.r, t)),
        g: Math.round(lerp(c1.g, c2.g, t)),
        b: Math.round(lerp(c1.b, c2.b, t))
    };
}

/**
 * Get color for a normalized value (0-1) using specified scale
 */
export function getColor(value: number, scaleType: ColorScaleType = 'density'): RGB {
    const scale = SCALES[scaleType];
    const clampedValue = Math.max(0, Math.min(1, value));
    
    // Find the two color stops to interpolate between
    for (let i = 0; i < scale.length - 1; i++) {
        const stop1 = scale[i];
        const stop2 = scale[i + 1];
        
        if (clampedValue >= stop1.position && clampedValue <= stop2.position) {
            const t = (clampedValue - stop1.position) / (stop2.position - stop1.position);
            return interpolateColor(stop1.color, stop2.color, t);
        }
    }
    
    // Fallback to last color
    return scale[scale.length - 1].color;
}

/**
 * Convert RGB to CSS color string
 */
export function rgbToString(color: RGB, alpha: number = 1): string {
    if (alpha < 1) {
        return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
    }
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/**
 * Convert RGB to hex string
 */
export function rgbToHex(color: RGB): string {
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

/**
 * Get color as CSS string for a normalized value
 */
export function getColorString(value: number, scaleType: ColorScaleType = 'density', alpha: number = 1): string {
    return rgbToString(getColor(value, scaleType), alpha);
}

/**
 * Generate gradient stops for CSS or canvas gradient
 */
export function getGradientStops(scaleType: ColorScaleType = 'density'): Array<{ position: number; color: string }> {
    const scale = SCALES[scaleType];
    return scale.map(stop => ({
        position: stop.position,
        color: rgbToString(stop.color)
    }));
}

/**
 * Create a canvas gradient for the legend
 */
export function createLegendGradient(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    scaleType: ColorScaleType = 'density',
    horizontal: boolean = true
): CanvasGradient {
    const gradient = horizontal
        ? ctx.createLinearGradient(x, y, x + width, y)
        : ctx.createLinearGradient(x, y, x, y + height);
    
    const stops = getGradientStops(scaleType);
    stops.forEach(stop => {
        gradient.addColorStop(stop.position, stop.color);
    });
    
    return gradient;
}

