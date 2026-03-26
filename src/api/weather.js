/**
 * src/api/weather.js — Current Weather API
 * Brand-new module. Fetches current temperature, humidity, and weather code
 * from the Open-Meteo forecast API for a given location.
 */

/**
 * Fetch current weather data for the given coordinates.
 *
 * @param {number} lat  Latitude.
 * @param {number} lng  Longitude.
 * @returns {Promise<{temperature: number, humidity: number, weatherCode: number}>}
 * @throws {Error} On non-OK HTTP response.
 */
export async function fetchWeather(lat, lng) {
    const params = new URLSearchParams({
        latitude:  lat,
        longitude: lng,
        current:   'temperature_2m,relative_humidity_2m,weather_code',
        timezone:  'auto',
    });

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`Weather API HTTP ${res.status}`);

    const data = await res.json();
    const c = data.current;

    return {
        temperature:  c.temperature_2m,
        humidity:     c.relative_humidity_2m,
        weatherCode:  c.weather_code,
    };
}
