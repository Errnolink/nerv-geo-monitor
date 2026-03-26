/**
 * src/map/marker.js — NERV-Styled Map Marker
 * Migrated from MapCtrl.updateMarker() in app.js (lines 137–145).
 * Uses .nerv-marker / .nerv-marker-ring / .nerv-marker-dot CSS classes
 * defined in css/hud.css.
 */

import { MapCtrl } from './map.js';

/** @type {import('maplibre-gl').Marker|null} */
let currentMarker = null;

/**
 * Place (or move) the NERV-styled marker on the map at the given position.
 * Resolves a CSS custom property variable to a concrete hex/rgb color,
 * applies it to ring border and dot fill, then flies the camera to the point.
 *
 * @param {number} lat           Latitude.
 * @param {number} lng           Longitude.
 * @param {string} cssColorVar   A CSS variable string such as `'var(--gr)'`.
 */
export function updateMarker(lat, lng, cssColorVar) {
    // Remove existing marker from the map
    if (currentMarker) {
        currentMarker.remove();
        currentMarker = null;
    }

    // Resolve the CSS variable to a concrete color value
    const propName = cssColorVar.replace('var(', '').replace(')', '').trim();
    const cVal = getComputedStyle(document.documentElement)
        .getPropertyValue(propName)
        .trim() || '#00E5FF';

    // Build the marker DOM element
    const el = document.createElement('div');
    el.className = 'nerv-marker';
    el.innerHTML =
        `<div class="nerv-marker-ring" style="border-color: ${cVal}"></div>` +
        `<div class="nerv-marker-dot" style="background-color: ${cVal}; box-shadow: 0 0 10px ${cVal}"></div>`;

    // Place marker on the map
    currentMarker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(MapCtrl.map);

    // Fly camera to the new position (keep zoom if already zoomed in)
    const zoom = MapCtrl.getZoom() < 8 ? 10 : MapCtrl.getZoom();
    MapCtrl.flyTo(lng, lat, zoom);
}
