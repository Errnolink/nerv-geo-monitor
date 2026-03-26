/**
 * src/api/air-quality.js — Air Quality Data API with In-Memory Cache
 * Migrated from app.js (Cache + API.fetchAQ). Cache is module-private;
 * only `fetchAirQuality` is exported.
 */

// --- MODULE-PRIVATE CACHE ---
/** @type {Map<string, {ts: number, res: Object}>} */
const _cache = new Map();

/**
 * Generate a cache key from lat/lng (rounded to 2 decimal places).
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
function _cacheKey(lat, lng) {
    return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

/**
 * Attempt to retrieve a cached result (valid for 15 minutes).
 * @param {number} lat
 * @param {number} lng
 * @returns {Object|null}
 */
function _cacheGet(lat, lng) {
    const key = _cacheKey(lat, lng);
    const entry = _cache.get(key);
    if (entry && (Date.now() - entry.ts < 15 * 60 * 1000)) return entry.res;
    return null;
}

/**
 * Store a result in the cache.
 * @param {number} lat
 * @param {number} lng
 * @param {Object} res
 */
function _cacheSet(lat, lng, res) {
    _cache.set(_cacheKey(lat, lng), { ts: Date.now(), res });
}

// --- PUBLIC API ---

/**
 * Fetch air quality data for the given coordinates.
 * Returns cached data (≤ 15 min old) without a network request.
 * Fetches PM2.5, PM10, CO, NO₂, SO₂, O₃, US AQI, EU AQI, UV index
 * for −1 past day and +2 forecast days.
 *
 * @param {number} lat  Latitude.
 * @param {number} lng  Longitude.
 * @returns {Promise<Object>}  Raw Open-Meteo air-quality API response.
 * @throws {Error} On non-OK HTTP response.
 */
export async function fetchAirQuality(lat, lng) {
    const cached = _cacheGet(lat, lng);
    if (cached) return cached;

    const vars = [
        'pm2_5', 'pm10', 'carbon_monoxide',
        'nitrogen_dioxide', 'sulphur_dioxide', 'ozone',
        'us_aqi', 'european_aqi', 'uv_index',
    ].join(',');

    const url =
        `https://air-quality-api.open-meteo.com/v1/air-quality` +
        `?latitude=${lat}&longitude=${lng}` +
        `&hourly=${vars}&timezone=auto&past_days=1&forecast_days=2`;

    const r = await fetch(url);
    if (!r.ok) throw new Error(`API HTTP ${r.status}`);
    const res = await r.json();

    _cacheSet(lat, lng, res);
    return res;
}
