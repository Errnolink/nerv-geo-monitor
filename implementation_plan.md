# NERV Geo-Monitor — UI/UX Refactor Implementation Plan

> **Audience:** AI execution model, receiving tasks sequentially.
> **Architecture:** Vanilla HTML / CSS / JS only. Native ES Modules (`<script type="module">`). Single `style.css` entry using `@import`. No bundlers, no frameworks.
> **Branch:** `alpha` on GitHub (`Errnolink/nerv-geo-monitor`)

---

## ✅ Progress Snapshot (as of 2026-03-26)

Tasks **1–20 are complete**. Tasks 1–7 committed to `origin/alpha` (`fbefb53`); Tasks 8–20 implemented locally on `preview-1`.

| # | Task | Status | Key Files |
|---|------|--------|-----------|
| 1 | Project Scaffolding | ✅ Done | `style.css`, `src/**`, `css/**` |
| 2 | CSS Design System (Tokens & Base) | ✅ Done | `css/tokens.css`, `css/base.css` |
| 3 | CSS Panels & Glassmorphism | ✅ Done | `css/panels.css` |
| 4 | CSS Topbar, Terminal, HUD | ✅ Done | `css/topbar.css`, `css/terminal.css`, `css/hud.css` |
| 5 | CSS Chart & Responsive | ✅ Done | `css/chart.css`, `css/responsive.css` |
| 6 | HTML Shell | ✅ Done | `index.html` |
| 7 | JS Module: State | ✅ Done | `src/state.js` |
| 8 | JS Module: Config | ✅ Done | `src/config.js` |
| 9 | JS Module: Geocode API | ✅ Done | `src/api/geocode.js` |
| 10 | JS Module: Air Quality API + Cache | ✅ Done | `src/api/air-quality.js` |
| 11 | JS Module: Weather API | ✅ Done | `src/api/weather.js` |
| 12 | JS Module: Map (Protomaps) | ✅ Done | `src/map/map.js` |
| 13 | JS Module: Marker | ✅ Done | `src/map/marker.js` |
| 14 | JS Module: Clock & Status Bar | ✅ Done | `src/ui/clock.js`, `src/ui/status-bar.js` |
| 15 | JS Module: Terminal Core | ✅ Done | `src/ui/terminal.js` |
| 16 | JS Module: Terminal Commands | ✅ Done | `src/ui/terminal-commands.js` |
| 17 | JS Module: HUD Panels | ✅ Done | `src/ui/panels.js` |
| 18 | JS Module: Chart | ✅ Done | `src/ui/chart.js` |
| 19 | JS Module: Main Orchestrator | ✅ Done | `src/main.js` |
| 20 | Polish & CRT Effects | ✅ Done | `css/base.css`, `src/**` |

> **All tasks executed. System ready for final verification.**

---

## Dependency Graph (read ↓)

```
Task 1  ✅ Scaffold folders & empty files
Task 2  ✅ CSS Design System (tokens, base, utilities)
Task 3  ✅ CSS Components: glassmorphism panels, clip-path notches
Task 4  ✅ CSS Components: topbar, terminal, HUD overlays
Task 5  ✅ CSS Components: waveform, pollutant bars, responsive
Task 6  ✅ HTML Shell: full-screen map canvas + floating HUD skeleton
Task 7  ✅ JS Module: src/state.js (global reactive state)
Task 8  → JS Module: src/config.js (constants, thresholds, pollutant info)
Task 9  → JS Module: src/api/geocode.js (Open-Meteo geocoding + autocomplete)
Task 10 → JS Module: src/api/air-quality.js (AQI fetch + cache)
Task 11 → JS Module: src/api/weather.js (Open-Meteo weather fetch)
Task 12 → JS Module: src/map/map.js (MapLibre + Protomaps vector tiles)
Task 13 → JS Module: src/map/marker.js (NERV-styled marker)
Task 14 → JS Module: src/ui/clock.js + src/ui/status-bar.js
Task 15 → JS Module: src/ui/terminal.js (command terminal core)
Task 16 → JS Module: src/ui/terminal-commands.js (command parsing + dispatch)
Task 17 → JS Module: src/ui/panels.js (AQI readout, severity, pollutant bars)
Task 18 → JS Module: src/ui/chart.js (waveform SVG)
Task 19 → JS Module: src/main.js (orchestrator / boot)
Task 20 → Polish: boot sequence animation, CRT overlay, final wiring
```

---

## Context: What Exists So Far

The old monolithic files (`app.js`, old `style.css`) at the project root are **preserved as reference** — do NOT delete them. All new code lives in `src/` and `css/`.

**Key architecture decisions already made:**
- `body` uses `position: relative; overflow: hidden` (not flexbox) — map is full-screen fixed, HUD panels float over it.
- `#map-wrap` is `position: fixed; inset: 0; z-index: var(--z-map)` — defined in `css/base.css`.
- HUD panels `#hud-left`, `#hud-right`, `#hud-chart` are positioned in `css/hud.css`.
- The search bar is **removed from the topbar** — all input goes through `#terminal`.
- `style.css` is now only `@import` statements.

---

## Task 8: JS Module — Config

**Target Files:** `src/config.js`

Migrate the entire `Config` object from old `app.js` (lines 17–37). Export as named `Config`. Keep `WAVE_COLS`, `LVS`, `getLv`, `POL_KEYS`, and `PI` exactly as they were.

Add a new `WEATHER_CODES` lookup table:
```javascript
export const WEATHER_CODES = {
    0: 'CLEAR SKY',
    1: 'MAINLY CLEAR', 2: 'PARTLY CLOUDY', 3: 'OVERCAST',
    45: 'FOG', 48: 'RIME FOG',
    51: 'LIGHT DRIZZLE', 53: 'MOD. DRIZZLE', 55: 'DENSE DRIZZLE',
    61: 'SLIGHT RAIN', 63: 'MOD. RAIN', 65: 'HEAVY RAIN',
    71: 'SLIGHT SNOW', 73: 'MOD. SNOW', 75: 'HEAVY SNOW',
    77: 'SNOW GRAINS',
    80: 'SLIGHT SHOWERS', 81: 'MOD. SHOWERS', 82: 'VIOLENT SHOWERS',
    85: 'SLIGHT SNOW SHWR', 86: 'HEAVY SNOW SHWR',
    95: 'THUNDERSTORM', 96: 'T-STORM W/ HAIL', 99: 'T-STORM W/ HEAVY HAIL',
};
```

**Output Constraint:** Output ONLY `src/config.js`.

---

## Task 9: JS Module — Geocode API

**Target Files:** `src/api/geocode.js`

Migrate `API.fetchSuggestions()` and `API.geocode()` from old `app.js` (lines 58–73). Export as named functions:

```javascript
export async function fetchSuggestions(query) { ... }
export async function geocode(query) { ... }
export async function getUserLocation() { ... }   // from old API.getUserLocation
export async function getIPLocation() { ... }     // from old API.getIPLocation
```

Logic is identical. Add JSDoc. Import nothing from other local modules.

**Output Constraint:** Output ONLY `src/api/geocode.js`.

---

## Task 10: JS Module — Air Quality API + Cache

**Target Files:** `src/api/air-quality.js`

Migrate `Cache` and `API.fetchAQ()` from old `app.js` (lines 39–84). `Cache` is module-private. Export only:

```javascript
export async function fetchAirQuality(lat, lng) { ... }
```

Logic is identical — check cache, fetch on miss, cache result, return data. Add JSDoc.

**Output Constraint:** Output ONLY `src/api/air-quality.js`.

---

## Task 11: JS Module — Weather API

**Target Files:** `src/api/weather.js`

Brand-new module. Fetch current weather from Open-Meteo's forecast API:

```javascript
export async function fetchWeather(lat, lng) {
    const params = new URLSearchParams({
        latitude: lat, longitude: lng,
        current: 'temperature_2m,relative_humidity_2m,weather_code',
        timezone: 'auto',
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`Weather API HTTP ${res.status}`);
    const data = await res.json();
    const c = data.current;
    return { temperature: c.temperature_2m, humidity: c.relative_humidity_2m, weatherCode: c.weather_code };
}
```

**Output Constraint:** Output ONLY `src/api/weather.js`.

---

## Task 12: JS Module — Map (Protomaps Vector Tiles)

**Target Files:** `src/map/map.js`

Migrate and transform `MapCtrl.init()` from old `app.js`. **Replace CARTO raster tiles with Protomaps free vector tiles:**

```
https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=1003762824b9687f
```

> [!IMPORTANT]
> If the Protomaps key above does not work, use placeholder `'YOUR_PROTOMAPS_KEY'` and the user will supply their own from https://protomaps.com.

Dark-themed MapLibre style with layers: dark background (`#070709`), water (`#0c0c14`), dark landuse, faint road lines (`#161620`), labels in `IBM Plex Mono`. Export:

```javascript
export const MapCtrl = {
    map: null,
    init() { ... },           // creates map in #map-wrap
    resize() { ... },
    flyTo(lng, lat, zoom) { ... },
    getZoom() { ... },
    onClick(callback) { ... },
};
```

`init()` creates the map in `#map-wrap`, center `[78.49, 17.38]`, zoom `11`, `attributionControl: false`. Wrap in try/catch, degrade gracefully on tile failure.

Also add to the map style:
```css
/* Ensure in css/base.css or css/hud.css */
.maplibregl-canvas { cursor: crosshair !important; }
.maplibregl-ctrl-bottom-right { display: none !important; }
```

**Output Constraint:** Output ONLY `src/map/map.js`.

---

## Task 13: JS Module — Marker

**Target Files:** `src/map/marker.js`

Migrate `MapCtrl.updateMarker()` from old `app.js` (lines 137–145):

```javascript
import { MapCtrl } from './map.js';

let currentMarker = null;

export function updateMarker(lat, lng, cssColorVar) { ... }
```

Logic: remove old marker, create DOM element with `.nerv-marker` / `.nerv-marker-ring` / `.nerv-marker-dot`, resolve CSS variable for inline styles, create `maplibregl.Marker`, set position, `flyTo`. The CSS for these classes is in `css/hud.css`.

**Output Constraint:** Output ONLY `src/map/marker.js`.

---

## Task 14: JS Module — Clock & Status Bar

**Target Files:** `src/ui/clock.js`, `src/ui/status-bar.js`

### `src/ui/clock.js`
```javascript
import { $ } from '../state.js';
export function initClock() {
    const update = () => { $('clk').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false }); };
    update(); setInterval(update, 1000);
}
```

### `src/ui/status-bar.js`
```javascript
import { $ } from '../state.js';
export function setStatus(text, level) { ... }   // updates #sys-stat text + color
export function showErr(message) { ... }          // shows #err-box for 5s + sets status
```

No `#sbar` in the new HTML. Status goes to `#sys-stat` in topbar. Errors go to `#err-box`.

**Output Constraint:** Output ONLY `src/ui/clock.js` and `src/ui/status-bar.js`.

---

## Task 15: JS Module — Terminal Core

**Target Files:** `src/ui/terminal.js`

```javascript
import { $, State } from '../state.js';

const MAX_LINES = 200;

export function termLog(text, type = 'info') { ... }
// Appends .terminal-line.terminal-line--{type} to #terminal-output, with [HH:MM:SS] prefix, auto-scrolls, trims to MAX_LINES.

export function initTerminal(onCommand) { ... }
// Attaches keydown to #terminal-inp (Enter → echo + dispatch), '/' global shortcut to focus, prints boot messages.

export function clearTerminal() { ... }
// Clears #terminal-output, resets State.terminalLines, prints "Terminal cleared."

export async function bootSequence(lines, delayMs = 80) { ... }
// Prints each {text, type} line with staggered delay.
```

**Output Constraint:** Output ONLY `src/ui/terminal.js`.

---

## Task 16: JS Module — Terminal Commands

**Target Files:** `src/ui/terminal-commands.js`

```javascript
import { termLog } from './terminal.js';
import { fetchSuggestions } from '../api/geocode.js';

export function createCommandHandler(actions) {
    return async function handleCommand(raw) { ... }
}
```

Built-in commands: `help`, `clear` (dynamic import `clearTerminal`), `clearlog`.
Coordinate regex: `/^(-?\d+\.?\d*)\s*[,\s]+\s*(-?\d+\.?\d*)$/`
Fallback: geocode and scan. Error format: `ERR: UPLINK FAILED — ${e.message}`.

`actions` shape: `{ doScan(lat, lng, name), startScan(raw), clearLog() }`.

**Output Constraint:** Output ONLY `src/ui/terminal-commands.js`.

---

## Task 17: JS Module — HUD Panels

**Target Files:** `src/ui/panels.js`

Migrate from old `app.js`: `UICtrl.buildBars()`, `UICtrl.addLog()`, `UICtrl.renderLog()`, `UICtrl.clearLog()`, `UICtrl.initMobileTabs()`, and `App.renderData()`.

```javascript
import { $, State } from '../state.js';
import { Config, WEATHER_CODES } from '../config.js';
import { updateMarker } from '../map/marker.js';
import { setStatus } from './status-bar.js';
import { updateWaveTabs, drawWave } from './chart.js';
import { termLog } from './terminal.js';

export function buildBars(hourlyData, currentIndex) { ... }
export function addLog(name, aqi, lat, lng) { ... }
export function renderLog() { ... }
export function clearLog() { ... }
export function initMobileTabs() { ... }
export function renderData(aqiData, weatherData, locName, lat, lng) { ... }
```

`renderData()` populates all HUD DOM. Also populate weather row:
- `$('w-temp').textContent = weatherData ? weatherData.temperature.toFixed(1) : '—'`
- `$('w-humid').textContent = weatherData ? weatherData.humidity : '—'`
- `$('w-code').textContent = weatherData ? (WEATHER_CODES[weatherData.weatherCode] || 'CODE ' + weatherData.weatherCode) : '—'`

After rendering, call `termLog('SCAN OK — US AQI ... [label] — city', 'system')`. Call `updateMarker(lat, lng, lv.col)`.

Module-private helpers: `currentIdx(times)`, `getDom(hourlyData, ci)`.

**Output Constraint:** Output ONLY `src/ui/panels.js`.

---

## Task 18: JS Module — Waveform Chart

**Target Files:** `src/ui/chart.js`

Migrate `ChartCtrl.updateWaveTabs()` and `ChartCtrl.drawWave()` from old `app.js` (lines 149–242).

```javascript
import { $, State } from '../state.js';
import { Config } from '../config.js';

export function updateWaveTabs() { ... }
export function drawWave(times, vals, currentIndex, waveKey) { ... }
```

`drawWave()` builds SVG inside `#wave-svg`. Keep all SVG logic: grid crosses, threshold lines, area path, solid past line, dashed forecast line, NOW marker, time labels. Add JSDoc and section comments.

**Output Constraint:** Output ONLY `src/ui/chart.js`.

---

## Task 19: JS Module — Main Orchestrator

**Target Files:** `src/main.js`

App entry point. Imports all modules. Exports nothing. Full source is in the original plan artifact.

Key structure:
```javascript
import { $, State } from './state.js';
import { Config } from './config.js';
import { geocode, getUserLocation, getIPLocation } from './api/geocode.js';
import { fetchAirQuality } from './api/air-quality.js';
import { fetchWeather } from './api/weather.js';
import { MapCtrl } from './map/map.js';
import { initClock } from './ui/clock.js';
import { setStatus, showErr } from './ui/status-bar.js';
import { initTerminal, termLog, bootSequence } from './ui/terminal.js';
import { createCommandHandler } from './ui/terminal-commands.js';
import { renderData, clearLog, initMobileTabs, addLog } from './ui/panels.js';
import { updateWaveTabs, drawWave } from './ui/chart.js';

async function doScan(lat, lng, name) { ... }   // fetches AQI + Weather in parallel, calls renderData
async function startScan(raw) { ... }            // parses coords or geocodes, then doScan
function updateWaveSize() { ... }               // handles waveform zoom
async function init() { ... }                   // full boot sequence + event wiring
window.addEventListener('load', init);
```

Boot sequence order in `init()`:
1. `bootSequence([...])` — animated terminal intro
2. `initClock()`, `MapCtrl.init()`, `initMobileTabs()`
3. `initTerminal(createCommandHandler({doScan, startScan, clearLog}))`
4. Map click handler, clear-btn listener, wave tabs, resize, wheel/pinch
5. Auto-detect location via GPS → IP fallback → default "Tokyo"

**Output Constraint:** Output ONLY `src/main.js`.

---

## Task 20: Polish — Boot Sequence, CRT Vignette, Final Wiring

**Target Files:** `css/base.css`, `src/ui/terminal.js`, `src/main.js`

### `css/base.css` additions
Add a vignette `body::before`:
```css
body::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: calc(var(--z-overlay) - 1);
    background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.45) 100%);
}
```

Add to map CSS (in `css/base.css` or `css/hud.css`):
```css
.maplibregl-canvas { cursor: crosshair !important; }
.maplibregl-ctrl-bottom-right { display: none !important; }
```

### `src/ui/terminal.js` addition
`bootSequence()` is already specified in Task 15 — just ensure it's exported.

### `src/main.js` — boot lines
```javascript
await bootSequence([
    { text: '████████████████████████████████████████', type: 'system' },
    { text: 'NERV GEO-MONITOR SYSTEM v10.0', type: 'system' },
    { text: 'MAGI SUPERCOMPUTER — MELCHIOR·01 CASPER·02 BALTHASAR·03', type: 'system' },
    { text: '████████████████████████████████████████', type: 'system' },
    { text: 'Initializing subsystems...', type: 'info' },
    { text: '  ├─ MapLibre GL JS ............... OK', type: 'info' },
    { text: '  ├─ Protomaps Vector Tiles ....... OK', type: 'info' },
    { text: '  ├─ Open-Meteo AQI Uplink ........ OK', type: 'info' },
    { text: '  ├─ Open-Meteo Weather Uplink .... OK', type: 'info' },
    { text: '  └─ Terminal Interface ........... OK', type: 'info' },
    { text: 'All systems nominal. Awaiting input.', type: 'system' },
], 60);
```

**Output Constraint:** Output ONLY the modified sections, with `// === FILE: path ===` headers.

---

## Verification Plan

After all 20 tasks, serve locally (`npx serve .` or VS Code Live Server) and verify:

1. Map loads full-screen with dark Protomaps vector tiles.
2. Topbar floats with NERV logo, live clock, and system status.
3. Terminal docked at bottom shows animated boot sequence.
4. Typing `Tokyo` → Enter: AQI + weather populates, waveform renders, marker appears on map.
5. `help` → command list; `clear` → terminal clears.
6. Map click → coordinate scan.
7. Wave tabs switch pollutants.
8. CRT scanlines + vignette visible.
9. No console errors on module imports.
10. Responsive ≤ 900px: mobile tabs appear, panels toggle correctly.

---

> [!IMPORTANT]
> **Execution Order is Critical.** Tasks 1–6 (scaffolding + CSS + HTML) are done. Tasks 8–19 can each be given to the model one at a time following the dependency graph above. Task 20 is a polish pass touching multiple files.
>
> **Reference file:** The original monolithic `app.js` at the project root is the source of truth for all migration tasks. Do not delete it.
