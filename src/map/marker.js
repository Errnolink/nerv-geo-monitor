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

/* ============================================================
   NERV MAP POPUP — location info attached to marker
   Fades out on map pan/zoom, fades back in on idle.
   ============================================================ */
let _popup = null;
let _dismissed = false;
let _hidingForMove = false;

function _ensurePopupListeners() {
    if (!MapCtrl.map || MapCtrl.map._nervPopupBound) return;
    MapCtrl.map._nervPopupBound = true;

    MapCtrl.map.on('movestart', () => {
        _hidingForMove = true;
        const el = _popup?.getElement?.();
        if (el) {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
        }
    });

    MapCtrl.map.on('idle', () => {
        _hidingForMove = false;
        if (!_dismissed) {
            const el = _popup?.getElement?.();
            if (el) {
                el.style.opacity = '1';
                el.style.pointerEvents = '';
            }
        }
    });
}

/**
 * Show a NERV-styled popup at the given marker location.
 * @param {string} name  Location display name.
 * @param {number} lat   Latitude.
 * @param {number} lng   Longitude.
 */
export function updatePopup(name, lat, lng) {
    if (!MapCtrl.map) return;
    _ensurePopupListeners();

    if (_popup) {
        _popup.remove();
        _popup = null;
    }

    _dismissed = false;

    const displayName = name.split(',')[0].toUpperCase().trim();
    const coords = `${parseFloat(lat).toFixed(4)}°N  ${parseFloat(lng).toFixed(4)}°E`;

    _popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        className: 'nerv-popup',
        offset: [0, -18],
        maxWidth: '240px'
    })
    .setLngLat([lng, lat])
    .setHTML(`
        <div class="nerv-popup-name">${displayName}</div>
        <div class="nerv-popup-coords">${coords}</div>
    `)
    .addTo(MapCtrl.map);

    // Track user-initiated close (close button) vs programmatic hide
    _popup.on('close', () => {
        if (!_hidingForMove) {
            _dismissed = true;
        }
    });
}
