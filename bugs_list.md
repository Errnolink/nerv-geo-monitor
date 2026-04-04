# NERV Style AQI - Bug Report

Here is a comprehensive list of bugs and visual/layout issues currently present in the NERV Geo-Monitor codebase. This list was compiled after testing the application dynamically.

## 1. Map Tile Loading Failure (CORS) - CRITICAL
* **Description:** The central map area (which should be the primary focus of the "GEO-MONITOR") is not rendering; it remains completely black/empty.
* **Root Cause:** A CORS policy error is blocking the tile fetch. The console logs report: `Access to fetch at 'https://api.protomaps.com/tiles/v4.json?key=1003762824b9687f' from origin 'http://127.0.0.1:8080' has been blocked by CORS policy`.
* **Impact:** Causes a massive visual void in the center of the UI, drastically degrading the application's aesthetic and core functionality. 
* **Note:** Misleadingly, the initializing terminal log visually reports `Protomaps Vector Tiles ....... OK`.

## 2. Repeated Flashing and UI Re-renders - HIGH
* **Description:** The UI components repeatedly flash, flicker, or "jump" during application usage.
* **Details:** Due to continuous state changes (scan loops), the UI (specifically the SCAN LOG, TERMINAL, and CURRENT STATUS components) aggressively re-renders. 
* **Potential Trigger Loop:** Terminal repeatedly logs `GPS unavailable, falling back to IP...` on each scan. This recursive or looped fallback scanning logic is directly triggering an uncontrolled re-render cadence, causing the continuous "flashing" behavior reported.

## 3. Layout: Alignment and Spacing Issues - MODERATE
* **Status Panel Z-Pattern Alignment:** In the `CURRENT STATUS` panel, the labels (e.g., "LOCATION", "COORDINATES") are left-aligned while their data values float far to the right. This creates a disjointed "Z-pattern" that is hard to scan visually for data.
* **Scan Log Cramping:** The "CLEAR" button in the Scan Log panel is poorly positioned. It nearly touches the top-right border of its container, lacking appropriate padding and margins.
* **Disconnected Floating Waveform:** Due to the map failing to load, the "AQI WAVEFORM" chart floats randomly without a defined container layout or structural anchor, making it feel disjointed.

## 4. UI/UX: Terminal Interface Flaws - MODERATE
* **Cut-off Logs:** The terminal output bar located at the bottom is noticeably very thin, essentially cutting off readable log history.
* **Input Field Positioning:** The actual terminal input area (`NERV://>`) is placed at the absolute bottom edge of the screen, making the entire "Dashboard" aesthetic seem incomplete and poorly padded.

## 5. Console Errors & Functional Gaps - LOW
* **Missing Favicon:** The console repeatedly reports a `404 (Not Found)` error for a missing `favicon.ico` file.
* **GPS Reliability logic:** The current GPS fallback logic to IP is robust but fails silently into a loop system instead of caching the first valid state to avoid repeatedly triggering IP fallback errors.

## 6. Protomaps API Implementation & Issues - TECHNICAL
* **Implementation Details:** The map utilizes `maplibregl` (MapLibre GL JS) to render vector tiles from Protomaps. The map style is manually constructed in `src/map/map.js` using specific layer configurations (e.g., background, earth, water, landuse, roads, places) to emulate a dark "NERV" theme.
* **The API Key Issue:** A hardcoded Protomaps API key (`1003762824b9687f`) is used (`https://api.protomaps.com/tiles/v4.json?key=1003762824b9687f`). The CORS error occurs because Protomaps API keys restrict access to registered origins (domains). Since you are running it on `http://127.0.0.1:8080`, the Protomaps server rejects the request. 
* **Fix Action:** Replace the hardcoded key with a valid one generated for your development environment or switch the URL to open-source raster tiles (like the CARTO dark tiles) temporarily.

## 7. Desired Layout Redesign (Feature Polish) - UPCOMING
* **Goal Layout:** The user has provided a structural wireframe for a new "floating" HUD design.
* **Map Integration (Background):** The map component should act as the persistent interactive background (`width: 100vw; height: 100vh; position: fixed; z-index: 0;`).
* **Top Header Bar:** A thin bar at the top containing "nerv" branding on the left, "time" on the right, and an "alert" sub-strip tucked just beneath the left side.
* **Left Floating Panel:** An isolated container pinned to the left displaying "AQI" data, with an AQI "graph" stacked at its bottom.
* **Right Floating Panel:** An isolated container pinned to the right displaying "weather" data, with a weather "graph" stacked at its bottom.
* **Map Object (Center/Dynamic):** A floating "location details" popup box connected via a stylized line to a specific point/marker on the map.
* **Terminal Dock (Bottom):** The command terminal runs horizontally across the entire bottom edge.

---
**Recommendation for fixing:**
1. Focus first on resolving the Protomaps CORS issue to fix the center map layout anchor (either by acquiring a new API key allowing `127.0.0.1` origin or falling back to raster map tiles).
2. Review the data fetching logic inside `src/main.js` to stop the `GPS unavailable, falling back to IP` loop which is triggering the re-renders that lead to the UI flashing phenomenon.
3. Overhaul the `index.html` structure and `css/base.css` to enable the full-screen map background and construct the exact floating top/bottom/left/right panel layout defined by the structural wireframe.

---
**Design & Execution Resource:**
For Claude / the implementation bot executing this visual overhaul, strongly leverage the open-source **[NERV UI Component Library](https://github.com/TheGreatGildo/nerv-ui)**. It provides pre-built Evangelion-inspired UI scaffolding, typography rules, color hexes (classic MAGI orange/red), and layout mechanics that will drastically cut down on reinventing the wheel to achieve the floating wireframe style.
