/**
 * Air Density Calculation Module
 * 
 * Calculates air density accounting for temperature, pressure, and humidity
 * using the ideal gas law with corrections for water vapor.
 */

// Constants
const Rd = 287.05;   // Specific gas constant for dry air (J/(kg·K))
const Rv = 461.495;  // Specific gas constant for water vapor (J/(kg·K))

/**
 * Calculate saturation vapor pressure using Magnus formula
 * @param tempCelsius - Temperature in degrees Celsius
 * @returns Saturation vapor pressure in hPa
 */
export function calculateSaturationVaporPressure(tempCelsius: number): number {
    // Magnus formula coefficients
    const a = 17.625;
    const b = 243.04;
    return 6.1094 * Math.exp((a * tempCelsius) / (tempCelsius + b));
}

/**
 * Calculate actual vapor pressure from relative humidity
 * @param tempCelsius - Temperature in degrees Celsius
 * @param relativeHumidity - Relative humidity (0-100)
 * @returns Actual vapor pressure in hPa
 */
export function calculateVaporPressure(tempCelsius: number, relativeHumidity: number): number {
    const saturationPressure = calculateSaturationVaporPressure(tempCelsius);
    return (relativeHumidity / 100) * saturationPressure;
}

/**
 * Calculate air density accounting for humidity
 * 
 * Formula: ρ = (Pd / (Rd * T)) + (Pv / (Rv * T))
 * Where:
 *   Pd = partial pressure of dry air (Pa)
 *   Pv = partial pressure of water vapor (Pa)
 *   Rd = specific gas constant for dry air
 *   Rv = specific gas constant for water vapor
 *   T = temperature in Kelvin
 * 
 * @param tempCelsius - Temperature in degrees Celsius
 * @param pressureHPa - Atmospheric pressure in hPa (hectopascals/millibars)
 * @param relativeHumidity - Relative humidity (0-100)
 * @returns Air density in kg/m³
 */
export function calculateAirDensity(
    tempCelsius: number,
    pressureHPa: number,
    relativeHumidity: number
): number {
    // Convert temperature to Kelvin
    const tempKelvin = tempCelsius + 273.15;
    
    // Calculate vapor pressure in hPa
    const vaporPressureHPa = calculateVaporPressure(tempCelsius, relativeHumidity);
    
    // Calculate partial pressure of dry air in hPa
    const dryAirPressureHPa = pressureHPa - vaporPressureHPa;
    
    // Convert pressures to Pascals (1 hPa = 100 Pa)
    const dryAirPressurePa = dryAirPressureHPa * 100;
    const vaporPressurePa = vaporPressureHPa * 100;
    
    // Calculate air density using ideal gas law with humidity correction
    const density = (dryAirPressurePa / (Rd * tempKelvin)) + (vaporPressurePa / (Rv * tempKelvin));
    
    return density;
}

/**
 * Calculate dry air density (without humidity correction)
 * Simpler formula when humidity data is not available
 * 
 * @param tempCelsius - Temperature in degrees Celsius
 * @param pressureHPa - Atmospheric pressure in hPa
 * @returns Air density in kg/m³
 */
export function calculateDryAirDensity(tempCelsius: number, pressureHPa: number): number {
    const tempKelvin = tempCelsius + 273.15;
    const pressurePa = pressureHPa * 100;
    return pressurePa / (Rd * tempKelvin);
}

/**
 * Air density ranges for color mapping
 * Based on typical atmospheric conditions:
 * - Sea level standard: ~1.225 kg/m³
 * - Hot/humid conditions: ~1.1 kg/m³
 * - Cold/dry conditions: ~1.4 kg/m³
 * - High altitude: ~0.9 kg/m³
 */
export const DENSITY_RANGE = {
    min: 0.85,   // Very high altitude or extreme heat
    max: 1.45,   // Very cold conditions at sea level
    standard: 1.225  // Standard sea level density
};

/**
 * Get a normalized value (0-1) for the density within the expected range
 * @param density - Air density in kg/m³
 * @returns Normalized value between 0 and 1
 */
export function normalizeDensity(density: number): number {
    const clamped = Math.max(DENSITY_RANGE.min, Math.min(DENSITY_RANGE.max, density));
    return (clamped - DENSITY_RANGE.min) / (DENSITY_RANGE.max - DENSITY_RANGE.min);
}

/**
 * Format density value for display
 * @param density - Air density in kg/m³
 * @returns Formatted string with units
 */
export function formatDensity(density: number): string {
    return `${density.toFixed(3)} kg/m³`;
}

