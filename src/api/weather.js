/**
 * src/api/weather.js — Weather API (Current + Hourly)
 * Fetches current conditions and 48h hourly forecast from Open-Meteo.
 */

const HOURLY_VARS = [
    'temperature_2m', 'relative_humidity_2m',
    'wind_speed_10m', 'surface_pressure', 'cloud_cover',
].join(',');

/**
 * Fetch current + hourly weather data for the given coordinates.
 *
 * @param {number} lat  Latitude.
 * @param {number} lng  Longitude.
 * @returns {Promise<{temperature: number, humidity: number, weatherCode: number, hourly: Object}>}
 * @throws {Error} On non-OK HTTP response.
 */
export async function fetchWeather(lat, lng) {
    const params = new URLSearchParams({
        latitude:  lat,
        longitude: lng,
        current:   'temperature_2m,relative_humidity_2m,weather_code',
        hourly:    HOURLY_VARS,
        timezone:  'auto',
        past_days: '1',
        forecast_days: '2',
    });

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`Weather API HTTP ${res.status}`);

    const data = await res.json();
    const c = data.current;

    return {
        temperature:  c.temperature_2m,
        humidity:     c.relative_humidity_2m,
        weatherCode:  c.weather_code,
        hourly:       data.hourly,   // { time, temperature_2m, wind_speed_10m, ... }
    };
}
