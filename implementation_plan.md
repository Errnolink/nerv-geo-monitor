# NERV Style AQI — Implementation Plan
**Version:** 2.0 (Full Rewrite) | **Date:** 2026-04-04
**Replaces all previous plans. Execute tasks strictly in sequential order.**

---

## Project Context

The NERV Geo-Monitor is a modular ES-module web app served statically (e.g. `http://127.0.0.1:8080`).

### File Map
| File | Role |
|---|---|
| `index.html` | HTML shell — all DOM structure lives here |
| `src/main.js` | App entry point: `init()`, `doScan()`, `startScan()` |
| `src/state.js` | Shared state object + `$()` selector helper |
| `src/config.js` | API endpoint config |
| `src/map/map.js` | MapLibre GL singleton (`MapCtrl`) |
| `src/map/marker.js` | Custom map marker |
| `src/api/geocode.js` | GPS + IP location detection |
| `src/api/air-quality.js` | Open-Meteo AQI fetch |
| `src/api/weather.js` | Open-Meteo weather fetch |
| `src/ui/panels.js` | `renderData()`, `clearLog()` |
| `src/ui/terminal.js` | `termLog()`, `bootSequence()` |
| `src/ui/terminal-commands.js` | Command handler |
| `src/ui/clock.js` | Live clock |
| `src/ui/status-bar.js` | `setStatus()`, `showErr()` |
| `src/ui/chart.js` | `drawWave()`, `updateWaveTabs()` |
| `css/tokens.css` | All CSS custom properties |
| `css/base.css` | Global reset, map canvas, CRT effects |
| `css/topbar.css` | Header bar |
| `css/hud.css` | Panel positions + AQI display styles |
| `css/panels.css` | `.nerv-panel`, `.phdr`, `.psec`, `.pval` |
| `css/chart.css` | Waveform chart styles |
| `css/terminal.css` | Terminal dock |
| `css/responsive.css` | Mobile breakpoints |

### Reference Library — NERV-UI (MANDATORY READING BEFORE PHASE 3)
Before executing any Phase 3 task, the agent MUST fetch and read both of these URLs in full:
1. **Design spec:** `https://raw.githubusercontent.com/TheGreatGildo/nerv-ui/main/SKILL.md`
2. **Stylesheet:** `https://raw.githubusercontent.com/TheGreatGildo/nerv-ui/main/nerv-ui.css`

From these, extract and use:
- All CSS custom property values (colors, font names)
- The `.panel` / `.panel-header` component structure
- The `.event-log` / `.el-body` terminal pattern
- The `scaleX(0.78–0.85)` mechanical compression rule
- The `.scan-line-overlay` CRT convention

---

## Phase 1 — Logic & Bug Fixes

---

### Task 1.1 — Fix Map CORS: Register Localhost on Protomaps API Key
**File:** `src/map/map.js`

**Problem:** Line 7 hard-codes key `1003762824b9687f`. Protomaps enforces a per-key origin allowlist. Since `http://127.0.0.1:8080` was never added to this key's allowed origins, every tile fetch is CORS-blocked and the map is black. Protomaps is NOT being replaced — only the key value changes.

**Steps:**
1. Go to `https://app.protomaps.com` → sign in → **API Keys**.
2. Edit the existing key (or create a new one). In the **Allowed Origins** field, add:
   - `http://127.0.0.1:8080`
   - `http://localhost:8080`
   - `http://localhost`
3. Copy the updated key string.
4. In `src/map/map.js`, change **line 7 only:**
   ```js
   // BEFORE:
   const PROTOMAPS_KEY = '1003762824b9687f';
   // AFTER:
   const PROTOMAPS_KEY = 'YOUR_NEW_KEY_HERE';
   ```
5. **Do not touch any other line in `map.js`.** `_buildStyle()`, all layer definitions, and `MapCtrl` stay exactly as-is.

**Verify:** Hard-refresh (`Ctrl+Shift+R`). Dark vector map renders. Zero CORS errors in console.

---

### Task 1.2 — Fix GPS Init: Add Scan-Lock Guard to `init()`
**File:** `src/main.js`

**Problem:** The `init()` function runs the GPS → IP → Tokyo fallback chain sequentially. There is no guard preventing re-entrant calls. More critically, `renderData()` (called inside `doScan()`) performs wholesale `innerHTML` replacements on panel containers — every call tears down all child DOM nodes and rebuilds them from scratch, causing the observed UI "flash" on every update.

**Steps:**

1. At the **top of `src/main.js`**, after all `import` statements, add:
   ```js
   let _initScanComplete = false;
   ```

2. In the `init()` function, locate the location-detection block (currently lines ~145–166). Replace it entirely with:
   ```js
   if (!_initScanComplete) {
       setStatus('DETECTING LOCATION...', 'or');
       try {
           const gps = await getUserLocation();
           _initScanComplete = true;
           const locName = `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)} (GPS)`;
           const inp = $('terminal-inp');
           if (inp) inp.value = locName;
           await doScan(gps.lat, gps.lng, locName);
       } catch (e) {
           termLog('GPS unavailable, falling back to IP...', 'warn');
           try {
               const d = await getIPLocation();
               _initScanComplete = true;
               const locName = d.city ? `${d.city}, ${d.region}` : 'Auto-Detected Location';
               const inp = $('terminal-inp');
               if (inp) inp.value = locName;
               await doScan(d.lat, d.lng, locName);
           } catch (err) {
               _initScanComplete = true;
               const inp = $('terminal-inp');
               if (inp) inp.value = 'Tokyo';
               await startScan('Tokyo');
           }
       }
   }
   ```

**Key changes from original:**
- `_initScanComplete = true` is set **before** `doScan()` runs, so the flag is set even if `doScan` itself throws.
- The fallback `termLog` type changes from `'info'` to `'warn'` to visually distinguish it in the terminal.
- The `if (!_initScanComplete)` guard prevents any future re-entrant invocation of this block.

---

### Task 1.3 — Fix UI Flash: Patch `renderData()` to Use Targeted DOM Updates
**File:** `src/ui/panels.js`

**Problem:** `renderData()` almost certainly uses `innerHTML` or `outerHTML` to update live data fields like `#c-aqi`, `#c-stat`, `#c-loc`, etc. This forces the browser to destroy and recreate DOM subtrees on every scan cycle, causing the visual "flash."

**Steps:**

1. Open `src/ui/panels.js`. Read the entire `renderData()` function.
2. For every line that writes to a **single data field** element (IDs: `c-aqi`, `c-stat`, `c-cat`, `c-stamp`, `c-loc`, `c-coords`, `c-ts`, `c-dom`, `c-eaqi`, `c-uv`, `w-temp`, `w-humid`, `w-code`), change `element.innerHTML = value` to `element.textContent = value`.
   - Only use `innerHTML` if the value string explicitly contains HTML tags (e.g. `<b>` or `<span>`). If it does not, always prefer `textContent`.
3. For the **scan log** (`#scan-log`): do NOT clear and rebuild the entire list on each scan. Instead, **prepend** new log entries:
   ```js
   const entry = document.createElement('div');
   entry.className = 'log-e';
   // Build the inner markup string for this single entry only
   entry.innerHTML = `
     <div class="log-ts">${timestamp}</div>
     <div class="log-nm">${locationName}</div>
     <div class="log-aq">
       <span class="log-aql">US AQI</span>
       <span class="log-aqv" style="color:${aqiColor}">${aqiValue}</span>
     </div>
   `;
   scanLog.prepend(entry);
   ```
4. Ensure `clearLog()` remains the **only** function that empties the scan log via `scanLog.innerHTML = ''`.

---

### Task 1.4 — Fix Missing Favicon (404 Console Error)
**File:** `index.html`

**Steps:**
Add the following line inside the `<head>` block, after the last `<meta>` tag:
```html
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23000'/><text x='50' y='72' font-size='70' text-anchor='middle' fill='%23FF9830'>N</text></svg>">
```
This is a self-contained inline SVG favicon. No external file needed. The `N` glyph uses the NERV orange `#FF9830` on a black background.

---

### Task 1.5 — Add `updateCenterCard()` to `src/ui/panels.js`
**File:** `src/ui/panels.js`

**Purpose:** Drive the floating location card (`#hud-center`) that appears over the map center after a scan completes (introduced in Phase 2 HTML revamp).

**Steps:**

1. Add this exported function anywhere in `panels.js`:
   ```js
   export function updateCenterCard(name, lat, lng) {
       const card = document.getElementById('hud-center');
       const locEl = document.getElementById('hcc-loc');
       const coordsEl = document.getElementById('hcc-coords');
       if (!card) return;
       if (locEl) locEl.textContent = name.split(',')[0].toUpperCase().trim();
       if (coordsEl) coordsEl.textContent =
           `${parseFloat(lat).toFixed(4)}°N  ${parseFloat(lng).toFixed(4)}°E`;
       card.style.display = 'block';
   }
   ```

2. At the very end of `renderData()`, call:
   ```js
   updateCenterCard(name, lat, lng);
   ```
   (The `renderData` function already receives `name`, `lat`, `lng` as parameters, so no new arguments are needed.)

---

## Phase 2 — Structural HTML & CSS Hardening

---

### Task 2.1 — Replace Google Fonts Link in `index.html`
**File:** `index.html`

**Problem:** Current font link (line 8) only loads `IBM Plex Mono` and `Bebas Neue`. The NERV-UI design spec requires four font families for the correct Evangelion aesthetic.

**Steps:**

Replace the existing `<link>` tag for Google Fonts (line 8) with:
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Display:wght@700;800;900&family=JetBrains+Mono:wght@400;500;700&family=Saira+Extra+Condensed:wght@400;600;700;800&family=Shippori+Mincho+B1:wght@500;700;800&display=swap" rel="stylesheet">
```

---

### Task 2.2 — Update CSS Design Tokens
**File:** `css/tokens.css`

**Steps:**

1. Update the `--mono`, `--stamp` font variables and add two new variables. Replace the entire `TYPOGRAPHY` section with:
   ```css
   /* --- TYPOGRAPHY (aligned with NERV-UI v2 spec) --- */
   --mono:   'JetBrains Mono', 'IBM Plex Mono', 'Courier New', monospace;
   --stamp:  'Saira Extra Condensed', 'Bebas Neue', 'Arial Narrow', sans-serif;
   --title:  'Noto Serif Display', 'Times New Roman', serif;
   --mincho: 'Shippori Mincho B1', 'YuMincho', serif;
   --compress: scaleX(0.82);  /* Mechanical compression — NERV-UI signature */
   ```

2. Update `--terminal-height` to give the output area more breathing room:
   ```css
   --terminal-height: 240px;
   ```

3. Verify these NERV-UI phosphor color values match exactly (do not change if already correct):
   ```css
   --or:  #FF9830;
   --gr:  #50FF50;
   --cy:  #20F0FF;
   --rd:  #FF3030;
   ```

---

### Task 2.3 — Harden Full-Screen Map Background
**File:** `css/base.css`

**Steps:**

1. Locate the `#map-wrap` rule (approximately lines 103–107). Replace it with:
   ```css
   #map-wrap {
       position: fixed;
       top: 0;
       left: 0;
       width: 100vw;
       height: 100vh;
       z-index: 0;
       pointer-events: auto;
   }
   ```
   The explicit `width: 100vw; height: 100vh` replaces the `inset: 0` shorthand to guarantee full coverage across all browsers.

2. The `body::after` scanline pseudo-element will be **removed** in Task 2.5 (replaced by a dedicated `.scan-line-overlay` div per NERV-UI convention). Do not change it yet — wait for Task 2.5.

---

### Task 2.4 — Full `index.html` Body Restructure
**File:** `index.html`

**Problem:** The current HTML body has the correct elements but incorrect hierarchy. The waveform chart is a standalone `#hud-chart` not anchored to the left panel. The right panel mixes weather with the scan log without a clear header. The terminal lacks a title bar. The center location card is missing.

**Steps:**

Replace the entire `<body>` content (everything between `<body>` and `</body>`) with the following. **Preserve the `<head>` block unchanged.**

```html
<body>

  <!-- ═══ LAYER 0: Full-screen interactive map canvas ═══ -->
  <div id="map-wrap"></div>

  <!-- ═══ LAYER 1: Top Header Bar ═══ -->
  <div class="hazard-border-top"></div>
  <header id="topbar">
    <div class="topbar-brand">
      <div class="logo">NERV</div>
      <div class="logo-sub">GEO-MONITOR <span class="logo-ver">v10.0</span></div>
    </div>
    <div class="topbar-alert-strip">
      <span class="alert-led" id="alert-led"></span>
      <span class="alert-text" id="alert-text">SYS NOMINAL</span>
    </div>
    <div class="sep"></div>
    <div class="topbar-r">
      <div class="clock" id="clk">--:--:--</div>
      <div class="top-sys">SYS: <b id="sys-stat" style="color:var(--gr)">STANDBY</b> // MAGI-01</div>
    </div>
  </header>

  <!-- ═══ LAYER 2: Left Floating Panel (AQI Data + Waveform Dock) ═══ -->
  <section id="hud-left" class="nerv-panel">

    <!-- Fixed: Panel header -->
    <div class="phdr phdr-rd"><span>◆ CURRENT STATUS</span></div>

    <!-- Fixed: AQI big number row -->
    <div class="aqi-big-wrap">
      <div class="aqi-num" id="c-aqi">—</div>
      <div class="aqi-right">
        <div class="aqi-status" id="c-stat">—</div>
        <div class="aqi-cat" id="c-cat">US AQI</div>
        <div class="aqi-stamp" id="c-stamp">STANDBY</div>
      </div>
    </div>

    <!-- Fixed: Severity bar -->
    <div class="sev-wrap">
      <div class="plbl">SEVERITY</div>
      <div class="sev-row" id="sev-row">
        <div class="sev-blk"></div><div class="sev-blk"></div>
        <div class="sev-blk"></div><div class="sev-blk"></div>
        <div class="sev-blk"></div>
      </div>
    </div>

    <!-- Scrollable: Location data + pollutant bars -->
    <div class="pscroll">
      <div class="psec"><div class="plbl">LOCATION</div><div class="pval" id="c-loc">—</div></div>
      <div class="psec"><div class="plbl">COORDINATES</div><div class="pval" id="c-coords">—</div></div>
      <div class="psec"><div class="plbl">DATA TIME</div><div class="pval" id="c-ts">—</div></div>
      <div class="psec"><div class="plbl">DOMINANT</div><div class="pval" id="c-dom">—</div></div>
      <div class="psec"><div class="plbl">EU AQI</div><div class="pval" id="c-eaqi">—</div></div>
      <div class="psec" style="border-bottom:none"><div class="plbl">UV INDEX</div><div class="pval" id="c-uv">—</div></div>
      <div class="phdr" style="margin-top:4px"><span>◆ POLLUTANTS</span></div>
      <div class="vbars-wrap"><div class="vbars-row" id="vbars-row"></div></div>
      <div class="pol-detail" id="pol-detail">
        <div class="pd-row">
          <div><div class="pd-lbl" id="pd-name">—</div></div>
          <div><div class="pd-lbl">WHO GUIDELINE</div><div class="pd-val" id="pd-who">—</div></div>
          <div><div class="pd-lbl">SOURCES</div><div class="pd-val" id="pd-src">—</div></div>
          <div><div class="pd-lbl">HEALTH EFFECTS</div><div class="pd-val" id="pd-fx">—</div></div>
        </div>
      </div>
    </div>

    <!--
      WAVEFORM DOCK: Fixed-height, non-scrolling.
      This div is a SIBLING of .pscroll (not a child).
      It is the last flex child of #hud-left, anchored to its bottom.
      id="hud-chart" is kept so src/ui/chart.js requires no changes.
    -->
    <div id="hud-chart" class="wave-dock">
      <div class="phdr" style="flex-shrink:0"><span>◆ AQI WAVEFORM — 48H · PAST ─── FORECAST ╌╌╌</span></div>
      <div id="wave-tabs">
        <button class="wtab on" data-wk="us_aqi">US AQI</button>
        <button class="wtab" data-wk="pm2_5">PM2.5</button>
        <button class="wtab" data-wk="pm10">PM10</button>
        <button class="wtab" data-wk="ozone">O₃</button>
        <button class="wtab" data-wk="nitrogen_dioxide">NO₂</button>
        <button class="wtab" data-wk="sulphur_dioxide">SO₂</button>
        <button class="wtab" data-wk="carbon_monoxide">CO</button>
      </div>
      <div id="wave-inner"><svg id="wave-svg"></svg></div>
    </div>

  </section>

  <!-- ═══ LAYER 2: Right Floating Panel (Weather + Scan Log) ═══ -->
  <section id="hud-right" class="nerv-panel">
    <div class="phdr"><span>◆ WEATHER DATA</span></div>
    <div class="weather-row" id="weather-row">
      <div class="weather-item">
        <div class="weather-val" id="w-temp">—</div>
        <div class="weather-lbl">TEMP °C</div>
      </div>
      <div class="weather-item">
        <div class="weather-val" id="w-humid">—</div>
        <div class="weather-lbl">HUMIDITY %</div>
      </div>
      <div class="weather-item">
        <div class="weather-val" id="w-code">—</div>
        <div class="weather-lbl">CONDITION</div>
      </div>
    </div>
    <div class="phdr">
      <span>◆ SCAN LOG</span>
      <button class="btn-clear" id="clear-btn">CLEAR</button>
    </div>
    <div class="pscroll" id="scan-log">
      <div style="padding:20px;font-size:13px;color:var(--mid);letter-spacing:1px;font-weight:700;">AWAITING FIRST SCAN...</div>
    </div>
  </section>

  <!-- ═══ LAYER 2: Center Floating Location Card ═══ -->
  <!--
    Visibility controlled by JS (updateCenterCard in panels.js).
    Starts hidden. Appears over map center after first scan.
    pointer-events: none — so it never blocks map click-to-scan.
  -->
  <div id="hud-center" class="hud-center-card" style="display:none;">
    <div class="hcc-label" id="hcc-loc">—</div>
    <div class="hcc-coords" id="hcc-coords">—</div>
    <div class="hcc-connector"></div>
  </div>

  <!-- ═══ Mobile tab navigation (hidden above 900px) ═══ -->
  <div id="mobile-tabs">
    <button class="mtab act" data-mt="left">DATA</button>
    <button class="mtab" data-mt="right">LOG</button>
  </div>

  <!-- ═══ LAYER 3: Bottom Terminal Dock ═══ -->
  <div class="hazard-border-bot"></div>
  <div id="terminal">
    <div class="terminal-header">
      <span class="terminal-title">NERV://TERMINAL</span>
      <span class="terminal-status" id="term-status">● ONLINE</span>
    </div>
    <div class="terminal-output" id="terminal-output"></div>
    <div class="terminal-input-row">
      <span class="terminal-prompt">NERV://&gt;</span>
      <input class="terminal-inp" id="terminal-inp"
             placeholder="Enter location or command (type HELP)..."
             autocomplete="off" spellcheck="false">
    </div>
  </div>

  <!-- ═══ Error overlay ═══ -->
  <div id="err-box"></div>

  <!-- ═══ NERV-UI CRT scan line overlay ═══ -->
  <div class="scan-line-overlay" aria-hidden="true"></div>

  <!-- ═══ App entry point ═══ -->
  <script type="module" src="src/main.js"></script>

</body>
```

---

### Task 2.5 — Add `.scan-line-overlay` CSS & Remove `body::after` Duplication
**File:** `css/base.css`

**Problem:** The CRT scanline effect is currently on `body::after`. NERV-UI uses a dedicated `.scan-line-overlay` div (added in Task 2.4). Both together would double the scanline opacity.

**Steps:**

1. Remove or comment out the `body::after { ... }` block entirely (approximately lines 40–58).
2. Add this rule at the end of `css/base.css`:
   ```css
   /* --- NERV-UI CRT SCAN LINE OVERLAY (matches nerv-ui convention) --- */
   .scan-line-overlay {
       position: fixed;
       inset: 0;
       pointer-events: none;
       z-index: calc(var(--z-overlay) - 1);
       background: repeating-linear-gradient(
           0deg,
           transparent,
           transparent 2px,
           rgba(0, 0, 0, 0.06) 2px,
           rgba(0, 0, 0, 0.06) 4px
       );
       animation: crt-scroll 10s linear infinite;
   }
   ```
   The `crt-scroll` keyframe is already defined in `base.css` — do not duplicate it.

---

## Phase 3 — UI Redesign (Floating HUD)

> **Mandatory:** Before writing any CSS in Phase 3, fetch and read:
> - `https://raw.githubusercontent.com/TheGreatGildo/nerv-ui/main/SKILL.md`
> - `https://raw.githubusercontent.com/TheGreatGildo/nerv-ui/main/nerv-ui.css`
>
> Use those files as the authoritative source for all component patterns, color values, and typography rules below.

---

### Task 3.1 — Overwrite `css/topbar.css`
**File:** `css/topbar.css`

Replace the **entire file** with:

```css
/* --- NERV GEO-MONITOR — TOPBAR (Floating, Glassmorphic) --- */
/* Adapted from nerv-ui .panel-header pattern + NERV-UI SKILL.md typography spec */

#topbar {
    position: fixed;
    top: 6px;               /* Clears the 6px hazard-border-top */
    left: 0;
    right: 0;
    height: var(--topbar-height);
    z-index: var(--z-terminal);
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 18px;
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border-bottom: 1px solid var(--border);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
}

/* ─── Brand block (left) ─────────────────────────────── */
.topbar-brand {
    display: flex;
    flex-direction: column;
    gap: 0;
    flex-shrink: 0;
}

/*
  NERV-UI: "Noto Serif Display weight 900, mechanically compressed"
  transform: scaleX(0.82) is the signature EVA look from SKILL.md
*/
.logo {
    font-family: var(--title);
    font-weight: 900;
    font-size: 26px;
    letter-spacing: 0.25em;
    color: var(--or);
    text-shadow: 0 0 18px rgba(255, 152, 48, 0.55);
    transform: var(--compress);      /* scaleX(0.82) from tokens.css */
    transform-origin: left center;
    line-height: 1;
    text-transform: uppercase;
}

.logo-sub {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--mid);
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-top: 2px;
}

.logo-ver {
    color: var(--cy);
}

/* ─── Alert strip (left, next to brand) ─────────────── */
.topbar-alert-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--border);
    padding: 4px 12px;
    flex-shrink: 0;
}

.alert-led {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--gr);
    box-shadow: 0 0 6px var(--gr);
    flex-shrink: 0;
    transition: background 0.3s, box-shadow 0.3s;
}

.alert-led.warn {
    background: var(--or);
    box-shadow: 0 0 6px var(--or);
}

.alert-led.crit {
    background: var(--rd);
    box-shadow: 0 0 6px var(--rd);
    animation: blink 0.5s infinite;
}

.alert-text {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--gr);
    letter-spacing: 2px;
    text-transform: uppercase;
}

/* ─── Flex spacer ─────────────────────────────────────── */
.sep {
    flex: 1;
}

/* ─── Right cluster (clock + system status) ──────────── */
.topbar-r {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
}

/* NERV-UI: Saira Extra Condensed for stamps/banners */
.clock {
    font-family: var(--stamp);
    font-size: 22px;
    letter-spacing: 3px;
    color: var(--cy);
    text-shadow: 0 0 10px rgba(32, 240, 255, 0.4);
    line-height: 1;
}

.top-sys {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--mid);
    letter-spacing: 1px;
    text-transform: uppercase;
}
```

---

### Task 3.2 — Update Panel Positions in `css/hud.css`
**File:** `css/hud.css`

Locate the three positioning blocks at the **top of the file** (`#hud-left`, `#hud-right`, `#hud-chart`) and replace them with:

```css
/* ============================================================
   HUD LEFT — AQI Data Panel (flex column with wave-dock child)
   ============================================================ */
#hud-left {
    position: fixed;
    top: calc(var(--topbar-height) + 6px + var(--hud-gap));
    left: var(--hud-gap);
    width: 320px;
    bottom: calc(var(--terminal-height) + 6px + var(--hud-gap));
    z-index: var(--z-hud);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* ============================================================
   HUD RIGHT — Weather + Scan Log Panel
   ============================================================ */
#hud-right {
    position: fixed;
    top: calc(var(--topbar-height) + 6px + var(--hud-gap));
    right: var(--hud-gap);
    width: 300px;
    bottom: calc(var(--terminal-height) + 6px + var(--hud-gap));
    z-index: var(--z-hud);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* ============================================================
   HUD CENTER — Floating location card over map
   pointer-events: none so it never blocks map click-to-scan
   ============================================================ */
.hud-center-card {
    position: fixed;
    top: calc(var(--topbar-height) + 6px + var(--hud-gap));
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-hud);
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border: 1px solid var(--border);
    border-top: 2px solid var(--cy);
    padding: 10px 18px;
    pointer-events: none;
    min-width: 200px;
    text-align: center;
}

.hcc-label {
    font-family: var(--stamp);
    font-size: 16px;
    letter-spacing: 3px;
    color: var(--or);
    text-transform: uppercase;
}

.hcc-coords {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--cy);
    letter-spacing: 1px;
    margin-top: 4px;
}

/* Thin vertical connector line pointing down toward the marker */
.hcc-connector {
    width: 1px;
    height: 24px;
    background: linear-gradient(to bottom, var(--cy), transparent);
    margin: 6px auto 0;
}
```

Also add the following fix for `.psec` to resolve the **Z-pattern alignment bug** (Bug #3 from `bugs_list.md`). Find the existing `.psec`, `.plbl`, `.pval` rules in `hud.css` or `panels.css` and replace them with:

```css
/* Fix: label and value inline, no floating Z-pattern */
.psec {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 7px 18px;
    border-bottom: 1px solid var(--border);
    gap: 12px;
}

.plbl {
    font-size: 9px;
    color: var(--or);
    letter-spacing: 2px;
    text-transform: uppercase;
    flex-shrink: 0;
}

.pval {
    font-size: 12px;
    color: var(--st);
    text-align: right;
    word-break: break-word;
    font-family: var(--mono);
}
```

---

### Task 3.3 — Update `.nerv-panel` & Panel Components in `css/panels.css`
**File:** `css/panels.css`

**Adapted from nerv-ui `.panel` component pattern (nerv-ui.css).**

Find the `.nerv-panel` class and update it. Then find `.phdr` and update it. Exact replacements:

```css
/*
  .nerv-panel — adapted from nerv-ui .panel:
  Glassmorphic, sharp corners, orange top-border accent.
  NERV-UI anti-pattern reminder: NO rounded corners, NO gray backgrounds.
*/
.nerv-panel {
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border: 1px solid var(--glass-border);
    border-top: 2px solid var(--or);   /* Orange top accent — nerv-ui panel pattern */
    box-shadow: var(--glass-shadow);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* Panel header — adapted from nerv-ui .panel-header */
.phdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 14px;
    border-bottom: 1px solid var(--border);
    background: rgba(255, 152, 48, 0.04);   /* Faint orange tint on header */
    font-family: var(--mono);
    font-size: 10px;
    color: var(--or);
    letter-spacing: 2px;
    text-transform: uppercase;
    flex-shrink: 0;
}

/* Red-accent variant for CURRENT STATUS header */
.phdr-rd {
    border-top: 2px solid var(--rd);
    color: var(--rd);
    background: rgba(255, 48, 48, 0.04);
}

/* Scrollable content region */
.pscroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;   /* Critical: allows flex child to shrink below content size */
}

/* CLEAR button — fix Bug #3: poor padding, touching border */
.btn-clear {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--mid);
    letter-spacing: 2px;
    padding: 3px 10px;
    border: 1px solid var(--border);
    background: transparent;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
    text-transform: uppercase;
    margin-left: auto;
}

.btn-clear:hover {
    color: var(--rd);
    border-color: var(--rd);
    background: rgba(255, 48, 48, 0.06);
}
```

---

### Task 3.4 — Add Wave Dock CSS to `css/chart.css`
**File:** `css/chart.css`

Add the following rules at the **top** of `css/chart.css`:

```css
/* ============================================================
   WAVE DOCK — fixed-height waveform section inside #hud-left
   Sits as a flex child BELOW .pscroll. Does NOT scroll.
   flex-shrink: 0 means it always keeps its height.
   ============================================================ */
.wave-dock {
    flex-shrink: 0;
    height: 160px;
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--border);
    overflow: hidden;
    background: rgba(0, 0, 0, 0.2);
}

#wave-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
}

#wave-tabs::-webkit-scrollbar { display: none; }

#wave-inner {
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    position: relative;
    min-height: 0;
}
```

Keep all existing `.wtab`, `#wave-svg`, and waveform stroke rules — do not remove them.

---

### Task 3.5 — Update Terminal Dock in `css/terminal.css`
**File:** `css/terminal.css`

1. Replace the existing `#terminal` block with:
   ```css
   #terminal {
       position: fixed;
       bottom: 0;
       left: 0;
       right: 0;
       height: var(--terminal-height);
       z-index: var(--z-terminal);
       display: flex;
       flex-direction: column;
       background: var(--glass-bg);
       backdrop-filter: blur(var(--glass-blur));
       -webkit-backdrop-filter: blur(var(--glass-blur));
       border-top: 2px solid var(--or);      /* Orange accent — NERV-UI panel pattern */
       box-shadow: 0 -4px 40px rgba(0, 0, 0, 0.75), 0 -1px 0 var(--border);
   }
   ```

2. Add the new terminal header styles (these are **new** — add them after the `#terminal` block):
   ```css
   /* Terminal title bar */
   .terminal-header {
       display: flex;
       align-items: center;
       justify-content: space-between;
       padding: 0 14px;
       height: 22px;
       border-bottom: 1px solid var(--border);
       background: rgba(255, 152, 48, 0.04);
       flex-shrink: 0;
   }

   .terminal-title {
       font-family: var(--mono);
       font-size: 9px;
       color: var(--or);
       letter-spacing: 3px;
       text-transform: uppercase;
   }

   .terminal-status {
       font-family: var(--mono);
       font-size: 9px;
       color: var(--gr);
       letter-spacing: 2px;
   }
   ```

3. Keep all existing `.terminal-output`, `.terminal-line`, `.terminal-input-row`, `.terminal-prompt`, `.terminal-inp` rules intact. Do not remove them.

---

### Task 3.6 — Fix Responsive CSS
**File:** `css/responsive.css`

1. Open `css/responsive.css`. Search for any rule referencing `#hud-chart` as a standalone positioned panel. Remove or comment out those rules — `#hud-chart` is now a `.wave-dock` inside `#hud-left`.

2. Ensure the `@media (max-width: 900px)` block includes:
   ```css
   @media (max-width: 900px) {
       /* Hide center card on mobile — no space for it */
       .hud-center-card {
           display: none !important;
       }

       /* Left panel full-width when active */
       #hud-left {
           left: 0;
           right: 0;
           width: 100%;
           bottom: calc(var(--terminal-height) + 6px + 48px); /* 48px = mobile-tabs height */
       }

       /* Right panel full-width when active */
       #hud-right {
           left: 0;
           right: 0;
           width: 100%;
           bottom: calc(var(--terminal-height) + 6px + 48px);
       }
   }
   ```

3. The existing `.mt-left-active` / `.mt-right-active` JS-driven visibility toggle logic in `src/ui/panels.js` (`initMobileTabs`) does not need changes — it targets `#hud-left` and `#hud-right` by ID which are still correct.

---

## Verification Checklist

After all tasks are complete, open the app in the browser and confirm every row passes:

| # | Check | Expected Result |
|---|---|---|
| 1 | Browser console | Zero CORS errors. Zero 404 errors. |
| 2 | Map | Dark Protomaps vector tiles render. Crosshair cursor. |
| 3 | Boot terminal | Prints `Protomaps Vector Tiles ....... OK` accurately |
| 4 | GPS init | Runs once only. "GPS unavailable" (if triggered) appears once in orange `warn` color, not green |
| 5 | UI on load | No panel flash or repaint during data population |
| 6 | Left panel: Status | AQI number, status, category visible in fixed header area |
| 7 | Left panel: Data rows | Labels and values in the same row (no Z-pattern). Label left, value right |
| 8 | Left panel: Waveform | Renders in the locked bottom dock (never scrolls away). Tabs functional |
| 9 | Right panel | Weather row at top with 3 columns. Scan log below with CLEAR button padded from border |
| 10 | Top bar | NERV logo uses Noto Serif Display (heavy, compressed). Clock in cyan. Alert LED green |
| 11 | Terminal | Full-width. Orange top border. Title bar visible. Input field has padding |
| 12 | Center card | Hidden on load. Appears over map center after first scan |
| 13 | Favicon | No 404 in console. Orange "N" icon visible in browser tab |
| 14 | Mobile (< 900px) | Panels stack full-width, center card hidden, tab buttons switch panels |

---

## Change Summary Table

| File | Change | Phase |
|---|---|---|
| `src/map/map.js` | Update Protomaps key constant (line 7 only) | 1.1 |
| `src/main.js` | Add `_initScanComplete` flag + rewrite init location block | 1.2 |
| `src/ui/panels.js` | Patch `renderData()` to use `textContent`; add `updateCenterCard()` | 1.3, 1.5 |
| `index.html` | New Google Fonts link, inline favicon, full body restructure, CRT div | 1.4, 2.1, 2.4 |
| `css/tokens.css` | Update font variables (`--title`, `--mincho`, `--compress`), terminal height | 2.2 |
| `css/base.css` | Harden `#map-wrap`; remove `body::after`; add `.scan-line-overlay` | 2.3, 2.5 |
| `css/topbar.css` | Full overwrite — NERV-UI fonts, compressed logo, alert strip | 3.1 |
| `css/hud.css` | Replace panel position blocks; add `.hud-center-card`; fix `.psec` layout | 3.2 |
| `css/panels.css` | Update `.nerv-panel`, `.phdr`, `.pscroll`, `.btn-clear` | 3.3 |
| `css/chart.css` | Add `.wave-dock` block at top of file | 3.4 |
| `css/terminal.css` | Update `#terminal`; add `.terminal-header`, `.terminal-title`, `.terminal-status` | 3.5 |
| `css/responsive.css` | Remove dead `#hud-chart` rules; add `.hud-center-card` mobile hide | 3.6 |
