# NERV Geo-Monitor — Issue Tracker

Rewritten against the current codebase. The previous revision described a
pre-refactor layout and listed several items that have since been implemented
(favicon, floating HUD layout, status-panel alignment, scan-log button spacing).

---

## OPEN

### 1. Protomaps API key is not valid for the serving origin — BLOCKING
* **Symptom:** The map area renders solid black. Terminal reports
  `Protomaps Vector Tiles ....... FAIL (403 — API key not valid for this origin)`.
* **Cause:** Protomaps keys are restricted to origins registered in the
  Protomaps dashboard. Verified directly:

  ```
  curl "https://api.protomaps.com/tiles/v4.json?key=cc5fcedd6f093b17"
  → 403  Invalid origin for API key
  ```

  This is the second key to fail this way; the previous one was
  `1003762824b9687f`.
* **Fix (requires dashboard access):** Register every origin the app is served
  from — `http://127.0.0.1:8080`, `http://localhost:8080`, and the deploy
  domain — against the key, or issue a new key. The constant lives at the top
  of `src/map/map.js` with the same note.
* **Alternatives considered and rejected:** switching to a keyless source
  (OpenFreeMap vector, CARTO dark raster). Both were verified working, but
  staying on Protomaps preserves the hand-built layer style in `_buildStyle()`.

### 2. `#term-status` is hardcoded — LOW
`● ONLINE` in the terminal header is static markup and never reflects real
uplink state. It stays green even when every API call is failing.

### 3. Dead LED styles — TRIVIAL
`.led`, `.led-gr`, `.led-or`, `.led-rd` in `css/hud.css` have no matching
element since the alert strip moved to `.alert-led`. Harmless, unreferenced.

### 4. Repeated scans of the same location do not update the log — BY DESIGN?
`addLog()` returns early when the incoming name matches the newest entry, so
re-scanning a location never refreshes its AQI or timestamp in the scan log.
Intentional de-duplication, but it means a stale reading can sit at the top.

---

## RESOLVED

### Silent breakage
* **`:.logo` invalid selector** (`css/topbar.css`) — a stray leading colon made
  the whole rule invalid, so the NERV wordmark had no font, size or colour.
* **Alert strip never updated** — `status-bar.js` targeted `#led`, which does
  not exist in `index.html`. It also wrote full status messages into
  `#sys-stat`, breaking the `SYS: … // MAGI-01` line. Now split: short state to
  `#sys-stat`, message to `#alert-text`, colour/blink to `#alert-led`.
* **Half the weather panel was never populated** — `#w-wind`, `#w-press` and
  `#w-cloud` existed in the markup but nothing wrote to them. They are not in
  the Open-Meteo `current` block, so they now read from the hourly series at
  the current hour.
* **Boot log always claimed the map loaded** — `Protomaps Vector Tiles ... OK`
  was a hardcoded string printed regardless of outcome, which is why issue #1
  went unnoticed. The tile layer now reports real `OK`/`FAIL` from its own
  `load` / `error` events.

### Logic
* **Severity class wiped mobile panel state** — `document.body.className =
  'lv' + n` clobbered `show-left` / `show-right`, so the visible panel
  disappeared after every scan on mobile.
* **Pollutant traces were squashed flat** — the chart's `150` y-axis floor
  exists to keep the US AQI threshold bands on screen, but it was applied to
  raw pollutants too. PM2.5 rarely exceeds 40 µg/m³, so its trace sat in the
  bottom few pixels. Now AQI-only.
* **Weather chart never redrew on resize** — only the AQI chart was in the
  resize path, so the weather viewBox kept its first-render width.
* **Stale weather on failure** — a failed weather fetch left the previous
  location's readings on screen. Panel and chart now clear.
* **`!y` rejected a legitimate `y === 0`** in threshold-line placement.
* **All-null data window** made `Math.min`/`Math.max` return `±Infinity` and
  filled the weather chart with `NaN` coordinates.
* **Async error escaped its handler** — `startScan` is async, but the
  `try/catch` in `terminal-commands.js` did not await it.
* **Out-of-range coordinates** reached the API and returned an opaque HTTP
  error; now rejected client-side with a clear message.
* **Error box used `innerHTML`** while geocode failures embed raw terminal
  input (`"Location not found: <query>"`). Built from text nodes now.

### UI / UX
* **Mobile layout collision** — the media query set the terminal to 160px while
  every fixed element anchored to the 150px `--terminal-height` token, and the
  40px tab bar overlapped the panels. Both are tokens now, and the hazard
  stripe and error toast clear the tab bar.
* **Mobile first load showed nothing** — the DATA tab rendered as selected
  while `show-left` was absent from `<body>`.
* **Tab autocomplete was a stub** — the placeholder advertised it,
  `#term-autocomplete` was in the markup, and `fetchSuggestions()` had zero
  callers. Implemented: debounced, ↑↓ to browse, Tab/Enter to accept, plus the
  missing dropdown CSS.
* **AQI chart pinned to 600px** inside a 320px panel, so it was permanently
  scrolled sideways and jumped size on the first window resize.
* **Long errors overflowed the viewport** — `white-space: nowrap` on `#err-box`.
* **Duplicate location readout** — a fixed `#hud-center` card showed the same
  name and coordinates as the marker popup, with a connector line pointing at
  nothing. Removed in favour of the marker popup, which is what the layout
  wireframe actually described.
* **Mobile tab mislabelled** — "LOG" showed the weather panel; the scan log
  moved into the terminal dock. Now "AQI" / "WEATHER".
* **Status readout stuck orange** after a scan finished, because `doScan` wrote
  to `#sys-stat` directly while `setStatus` also owned it.

### Cleanup
* Deduplicated the current-hour index helper (`currentIdx`), which existed
  twice with identical bodies in `main.js` and `panels.js`.
* Removed two unnecessary dynamic `import()` calls for statically-imported
  modules.
* Removed a dead write to `#c-coords`, an element no longer in the markup.
* Guarded `updateMarker` against a failed map init.
* Southern/western coordinates no longer display as `°N` / `°E`.

---

## Verification

No test suite exists. Checks run against this revision:

* All 14 ES modules parse (`node --check`).
* Every named import resolves to a real export; no import cycles — relevant
  because `map.js → ui/terminal.js` was added for failure reporting.
* Every element ID referenced from JS exists in `index.html`.
* CSS braces balanced; no malformed selectors of the `:.logo` shape remain.
* Browser verification not performed — no browser tooling available in the
  session that produced this revision.
