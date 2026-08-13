/**
 * src/map/map.js — MapLibre GL Map Controller
 * Renders Protomaps vector tiles with a hand-built dark NERV style.
 * Exports the `MapCtrl` singleton used throughout the app.
 *
 * ─────────────────────────────────────────────────────────────────
 * API KEY — READ THIS IF THE MAP IS BLACK
 * Protomaps keys are restricted to origins registered in the Protomaps
 * dashboard. A request from an unregistered origin is rejected with
 * `403 Invalid origin for API key` and every tile fails, leaving the map
 * empty. If the map does not render, register the origin you are serving
 * from (e.g. `http://127.0.0.1:8080`, `http://localhost:8080`, plus your
 * deploy domain) against this key, or paste a new key below.
 * Failures are reported in the terminal as `Protomaps Vector Tiles ... FAIL`.
 * ─────────────────────────────────────────────────────────────────
 */

import { termLog } from '../ui/terminal.js';

const PROTOMAPS_KEY = 'cc5fcedd6f093b17';
const PROTOMAPS_URL = `https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=${PROTOMAPS_KEY}`;

/** @type {import('maplibre-gl').Map|null} */
let _map = null;

/**
 * Build the dark MapLibre style using Protomaps vector tiles.
 * Layers: background, water, landuse, roads (faint), labels (IBM Plex Mono).
 * @returns {Object} MapLibre style spec
 */
function _buildStyle() {
    return {
        version: 8,
        glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
        sources: {
            protomaps: {
                type: 'vector',
                url: `https://api.protomaps.com/tiles/v4.json?key=${PROTOMAPS_KEY}`,
                attribution: '© Protomaps © OpenStreetMap',
            },
        },
        layers: [
            // --- Background ---
            {
                id: 'background',
                type: 'background',
                paint: { 'background-color': '#070709' },
            },
            // --- Earth fill ---
            {
                id: 'earth',
                type: 'fill',
                source: 'protomaps',
                'source-layer': 'earth',
                paint: { 'fill-color': '#0a0a0f' },
            },
            // --- Water ---
            {
                id: 'water',
                type: 'fill',
                source: 'protomaps',
                'source-layer': 'water',
                paint: { 'fill-color': '#0c0c14' },
            },
            // --- Landuse (parks etc.) ---
            {
                id: 'landuse',
                type: 'fill',
                source: 'protomaps',
                'source-layer': 'landuse',
                paint: { 'fill-color': '#0d0d12', 'fill-opacity': 0.8 },
            },
            // --- Roads (very faint) ---
            {
                id: 'roads',
                type: 'line',
                source: 'protomaps',
                'source-layer': 'roads',
                paint: {
                    'line-color': '#161620',
                    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 14, 1.5],
                },
            },
            // --- Place labels ---
            {
                id: 'places',
                type: 'symbol',
                source: 'protomaps',
                'source-layer': 'places',
                layout: {
                    'text-field': ['get', 'name'],
                    'text-font': ['Noto Sans Regular'],
                    'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 14, 13],
                    'text-max-width': 8,
                },
                paint: {
                    'text-color': '#4a4a6a',
                    'text-halo-color': '#070709',
                    'text-halo-width': 1.5,
                },
            },
        ],
    };
}

/**
 * MapLibre GL map controller singleton.
 */
export const MapCtrl = {
    /** @type {import('maplibre-gl').Map|null} */
    map: null,

    /** @type {boolean} True once the style and first tiles have loaded. */
    loaded: false,

    /**
     * Initialise the map inside `#map-wrap`.
     * Uses Protomaps vector tiles with a NERV dark theme.
     * Reports real load/failure state to the terminal instead of assuming OK.
     */
    init() {
        try {
            this.map = new maplibregl.Map({
                container: 'map-wrap',
                style: _buildStyle(),
                center: [78.49, 17.38],
                zoom: 11,
                attributionControl: false,
            });
            _map = this.map;

            this.map.on('load', () => {
                this.loaded = true;
                termLog('  └─ Protomaps Vector Tiles ....... OK', 'info');
            });

            // Report tile/style failures once rather than spamming per tile.
            // An origin-restricted API key surfaces here as a 403.
            let errorReported = false;
            this.map.on('error', e => {
                console.error('[MapCtrl]', e?.error || e);
                if (errorReported) return;
                errorReported = true;
                const msg = e?.error?.status === 403
                    ? '403 — API key not valid for this origin'
                    : (e?.error?.message || 'tile error');
                termLog(`  └─ Protomaps Vector Tiles ....... FAIL (${msg})`, 'error');
                termLog('     Register this origin on the Protomaps key — see src/map/map.js', 'warn');
            });
        } catch (err) {
            console.error('[MapCtrl] Map init failed:', err);
            termLog(`  └─ Protomaps Vector Tiles ....... FAIL (${err.message})`, 'error');
        }
    },

    /** Trigger a resize — call after layout changes. */
    resize() {
        this.map?.resize();
    },

    /**
     * Fly the camera to a new position.
     * @param {number} lng
     * @param {number} lat
     * @param {number} [zoom]
     */
    flyTo(lng, lat, zoom) {
        if (!this.map) return;
        this.map.flyTo({
            center: [lng, lat],
            zoom: zoom ?? this.map.getZoom(),
            speed: 1.8,
            curve: 1,
        });
    },

    /**
     * Return the current zoom level.
     * @returns {number}
     */
    getZoom() {
        return this.map?.getZoom() ?? 11;
    },

    /**
     * Register a click callback on the map.
     * Callback receives `{ lat, lng }`.
     * @param {function({lat: number, lng: number}): void} callback
     */
    onClick(callback) {
        if (!this.map) return;
        this.map.on('click', e => callback({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    },
};
