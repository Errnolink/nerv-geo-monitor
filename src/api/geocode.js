/**
 * src/api/geocode.js — Geocoding & Location API
 * Migrated from the monolithic app.js (API.fetchSuggestions, API.geocode,
 * API.getUserLocation, API.getIPLocation). No local module imports.
 */

const GEO_BASE = 'https://geocoding-api.open-meteo.com/v1/search';

/**
 * Fetch autocomplete suggestions for a partial location query.
 * Returns up to 6 results. Never throws — returns [] on any error.
 *
 * @param {string} query  Partial location name typed by the user.
 * @returns {Promise<Array<{lat: number, lng: number, display: string}>>}
 */
export async function fetchSuggestions(query) {
    try {
        const url = `${GEO_BASE}?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.results) return [];
        return data.results.map(r => ({
            lat: r.latitude,
            lng: r.longitude,
            display: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
        }));
    } catch {
        return [];
    }
}

/**
 * Geocode an exact location query, returning the best match.
 * Throws if no result is found.
 *
 * @param {string} query  Location name (e.g. "Tokyo").
 * @returns {Promise<{lat: number, lng: number, name: string}>}
 * @throws {Error} If the location cannot be resolved.
 */
export async function geocode(query) {
    const url = `${GEO_BASE}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const r = await fetch(url);
    const d = await r.json();
    if (!d.results?.[0]) throw new Error('Location not found: ' + query);
    const res = d.results[0];
    return {
        lat: res.latitude,
        lng: res.longitude,
        name: [res.name, res.admin1, res.country].filter(Boolean).join(', '),
    };
}

/**
 * Obtain the user's GPS coordinates via the browser Geolocation API.
 * Times out after 5 seconds.
 *
 * @returns {Promise<{lat: number, lng: number}>}
 * @throws {Error} If geolocation is unavailable or the user denies permission.
 */
export async function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject(new Error('Geolocation not supported'));
        }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            err => reject(err),
            { timeout: 5000 },
        );
    });
}

/**
 * Obtain an approximate location from the user's IP address via ipapi.co.
 *
 * @returns {Promise<{lat: number, lng: number, city: string, region: string}>}
 * @throws {Error} If no coordinates are returned.
 */
export async function getIPLocation() {
    const r = await fetch('https://ipapi.co/json/');
    const d = await r.json();
    if (d.latitude && d.longitude) {
        return {
            lat: d.latitude,
            lng: d.longitude,
            city: d.city,
            region: d.region_code || d.country_name,
        };
    }
    throw new Error('No coordinates returned from IP.');
}
