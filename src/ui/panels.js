import { $, State } from '../state.js';
import { Config, WEATHER_CODES } from '../config.js';
import { updateMarker, updatePopup } from '../map/marker.js';
import { setStatus } from './status-bar.js';
import { updateWaveTabs, drawWave, updateWeatherWaveTabs, drawWeatherWave } from './chart.js';
import { termLog } from './terminal.js';

/**
 * Index of the hour closest to (but not after) now within an Open-Meteo
 * `hourly.time` array. Shared by the AQI and weather series.
 * @param {string[]} times
 * @returns {number}
 */
export function currentIdx(times) {
    const n = new Date();
    const pad = x => String(x).padStart(2, '0');
    const t = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:00`;
    let b = 0;
    times.forEach((v, i) => { if (v <= t) b = i; });
    return b;
}

function getDom(h, ci) {
    const m = { 'PM2.5': 'pm2_5', 'PM10': 'pm10', 'O₃': 'ozone', 'NO₂': 'nitrogen_dioxide', 'SO₂': 'sulphur_dioxide' };
    let best = null, bv = -1;
    Object.entries(m).forEach(([nm, k]) => {
        const p = Config.PI[k], v = h[k]?.[ci];
        if (v != null && p?.who) { const r = v / p.who; if (r > bv) { bv = r; best = nm; } }
    });
    return best || 'PM2.5';
}

export function buildBars(hourlyData, currentIndex) {
    const row = $('vbars-row'); 
    if (!row) return;
    row.innerHTML = '';
    const polDetail = $('pol-detail');
    if (polDetail) polDetail.classList.remove('show');
    
    Config.POL_KEYS.forEach(k => {
        const p = Config.PI[k], val = hourlyData[k]?.[currentIndex]; 
        if (val == null) return;
        const v = parseFloat(val.toFixed(1));
        const rawPct = p.who ? (v / p.who) * 100 : (v / 100) * 100;
        const pct = Math.min(100, Math.max(2, rawPct));

        const bc = rawPct < 50 ? 'var(--gr)' : rawPct < 100 ? 'var(--or)' : 'var(--rd)';
        const ex = p.who && v > p.who;
        const w = document.createElement('div'); w.className = 'vbw';
        w.innerHTML = `<div class="vbar"><div class="vbf" data-p="${pct}" style="background:${bc};opacity:.9;box-shadow:0 0 10px ${bc}"></div></div>
      <div class="vb-n">${p.n}</div><div class="vb-v" style="color:${bc}">${v}</div><div class="vb-u">${p.u}${ex ? ' ★' : ''}</div>`;
        w.onclick = () => {
            const was = w.classList.contains('act');
            document.querySelectorAll('.vbw').forEach(x => x.classList.remove('act'));
            const det = $('pol-detail');
            if (det) {
                if (!was) {
                    w.classList.add('act');
                    if ($('pd-name')) $('pd-name').textContent = `${p.n} (${p.jp}) — ${v} ${p.u}`;
                    if ($('pd-who')) {
                        $('pd-who').className = `pd-val ${ex ? 'pd-who-ex' : 'pd-who-ok'}`;
                        $('pd-who').textContent = `${p.who} ${p.u} — ${ex ? `EXCEEDED +${Math.round((v / p.who - 1) * 100)}%` : 'WITHIN LIMITS'}`;
                    }
                    if ($('pd-src')) $('pd-src').textContent = p.src; 
                    if ($('pd-fx')) $('pd-fx').textContent = p.fx;
                    det.classList.add('show');
                    det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    det.classList.remove('show');
                }
            }
        };
        row.appendChild(w);
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
        document.querySelectorAll('.vbf').forEach(b => {
            if (b.dataset.p) b.style.height = b.dataset.p + '%';
        });
    }));
}

export function addLog(name, aqi, lat, lng) {
    if (State.scanLog.length > 0 && State.scanLog[0].nm === name) return;
    const now = new Date();
    State.scanLog.unshift({ nm: name, aqi, lat, lng, t: now });
    
    const el = $('scan-log');
    if (el) {
        if (el.children.length === 1 && !el.children[0].classList.contains('log-e')) {
            el.innerHTML = '';
        }
        document.querySelectorAll('.log-e.cur').forEach(c => c.classList.remove('cur'));
        
        const lv = Config.getLv(aqi), pad = n => String(n).padStart(2, '0');
        const ts = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const entry = document.createElement('div');
        entry.className = 'log-e cur';
        entry.innerHTML = `<div class="log-ts">${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${ts}</div>
      <div class="log-nm" style="color:${lv.col}">${name.split(',').slice(0, 2).join(',')}</div>
      <div class="log-aq"><span class="log-aql">US AQI</span><span class="log-aqv" style="color:${lv.col}; text-shadow:0 0 5px ${lv.col}">${aqi} — ${lv.label}</span></div>`;
        entry.onclick = () => {
            const inp = $('terminal-inp');
            if (inp) {
                inp.value = name;
            }
            window.dispatchEvent(new CustomEvent('scan-request', { detail: { lat, lng, name } }));
        };
        el.prepend(entry);
    }
    
    if (State.scanLog.length > 14) {
        State.scanLog.pop();
        if (el && el.lastChild) el.removeChild(el.lastChild);
    }
}

export function renderLog() {
    const el = $('scan-log');
    if (!el) return;
    el.innerHTML = '';
    if (State.scanLog.length === 0) {
        el.innerHTML = '<div style="padding:20px;font-size:13px;color:var(--mid);letter-spacing:1px;font-weight:700;">LOG CLEARED...</div>';
        return;
    }
    State.scanLog.forEach((e, i) => {
        const lv = Config.getLv(e.aqi), pad = n => String(n).padStart(2, '0');
        const ts = `${pad(e.t.getHours())}:${pad(e.t.getMinutes())}:${pad(e.t.getSeconds())}`;
        const d = document.createElement('div'); d.className = 'log-e' + (i === 0 ? ' cur' : '');
        d.innerHTML = `<div class="log-ts">${e.t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${ts}</div>
      <div class="log-nm" style="color:${lv.col}">${e.nm.split(',').slice(0, 2).join(',')}</div>
      <div class="log-aq"><span class="log-aql">US AQI</span><span class="log-aqv" style="color:${lv.col}; text-shadow:0 0 5px ${lv.col}">${e.aqi} — ${lv.label}</span></div>`;
        d.onclick = () => {
            const inp = $('terminal-inp');
            if (inp) {
                inp.value = e.nm;
            }
            window.dispatchEvent(new CustomEvent('scan-request', { detail: { lat: e.lat, lng: e.lng, name: e.nm } }));
        };
        el.appendChild(d);
    });
}

export function clearLog() {
    State.scanLog = [];
    renderLog();
}

export function initMobileTabs() {
    const tabs = document.querySelectorAll('.mtab');

    // Sync body state to whichever tab is marked active in the markup.
    // Without this the DATA tab renders as selected while `show-left` is
    // absent, so no panel is visible at all on first load.
    const initial = document.querySelector('.mtab.act');
    if (initial) document.body.classList.add('show-' + initial.dataset.mt);

    tabs.forEach(t => {
        t.addEventListener('click', (e) => {
            const target = t.dataset.mt;
            const isActive = document.body.classList.contains('show-' + target);
            
            tabs.forEach(x => x.classList.remove('act'));
            document.body.classList.remove('show-left', 'show-right');
            
            if (!isActive) {
                t.classList.add('act');
                document.body.classList.add('show-' + target);
            }
            setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 50);
        });
    });
}

/**
 * Populate the six weather tiles and the weather waveform.
 *
 * Wind, pressure and cloud cover are not in Open-Meteo's `current` block for
 * this request, so they are read from the hourly series at the current hour —
 * previously those three tiles were never written to and sat on '—' forever.
 *
 * @param {Object|null} weatherData  Result of fetchWeather(), or null if it failed.
 */
function renderWeather(weatherData) {
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };

    if (!weatherData) {
        // Weather fetch failed — clear the panel rather than leaving the
        // previous location's readings on screen.
        State.weather = null;
        ['w-temp', 'w-humid', 'w-code', 'w-wind', 'w-press', 'w-cloud'].forEach(id => set(id, '—'));
        const svg = $('weather-wave-svg');
        if (svg) svg.innerHTML = '';
        return;
    }

    State.weather = weatherData;

    set('w-temp', weatherData.temperature != null ? weatherData.temperature.toFixed(1) : '—');
    set('w-humid', weatherData.humidity ?? '—');
    set('w-code', WEATHER_CODES[weatherData.weatherCode] || 'CODE ' + weatherData.weatherCode);

    const wh = weatherData.hourly;
    if (!wh?.time) return;

    const wci = currentIdx(wh.time);
    const at = key => {
        const v = wh[key]?.[wci];
        return v == null ? '—' : Math.round(v);
    };
    set('w-wind', at('wind_speed_10m'));
    set('w-press', at('surface_pressure'));
    set('w-cloud', at('cloud_cover'));

    updateWeatherWaveTabs();
    drawWeatherWave(wh.time, wh[State.weatherWaveKey], wci, State.weatherWaveKey);
}

export function renderData(aqiData, weatherData, locName, lat, lng) {
    State.data = aqiData; 
    const h = aqiData.hourly, times = h.time;
    State.ci = currentIdx(times); 
    const ci = State.ci;
    
    const usAqi = h.us_aqi[ci] ?? 0, euAqi = h.european_aqi[ci] ?? 0;
    const lv = Config.getLv(usAqi), dom = getDom(h, ci);
    const uv = h.uv_index?.[ci], now = new Date(times[ci]);

    // Swap only the severity class — `show-left` / `show-right` drive the
    // mobile panel visibility and must survive a scan.
    document.body.classList.remove('lv0', 'lv1', 'lv2', 'lv3', 'lv4', 'lv5');
    document.body.classList.add(`lv${lv.lv}`);
    document.documentElement.style.setProperty('--ac', lv.col);

    if ($('c-aqi')) $('c-aqi').textContent = usAqi;
    if ($('c-stat')) $('c-stat').textContent = lv.label;
    if ($('c-cat')) $('c-cat').textContent = lv.cat.toUpperCase();
    if ($('c-stamp')) $('c-stamp').textContent = lv.label;
    if ($('c-loc')) {
        $('c-loc').textContent = locName.split(',').slice(0, 2).join(',');
        $('c-loc').style.color = lv.col;
    }
    if ($('c-ts')) $('c-ts').textContent = now.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    if ($('c-dom')) $('c-dom').textContent = dom; 
    if ($('c-eaqi')) $('c-eaqi').textContent = euAqi + ' (EU)';
    if ($('c-uv')) $('c-uv').textContent = uv != null ? `${uv.toFixed(1)} — ${uv < 3 ? 'LOW' : uv < 6 ? 'MODERATE' : uv < 8 ? 'HIGH' : 'VERY HIGH'}` : '—';

    const sevRow = $('sev-row');
    if (sevRow) {
        const sevs = sevRow.children;
        for (let i = 0; i < 5; i++) {
            if (sevs[i]) sevs[i].style.background = i <= lv.lv ? 'var(--ac)' : 'var(--dim)';
        }
    }

    renderWeather(weatherData);

    updateMarker(lat, lng, lv.col);
    updateWaveTabs();
    drawWave(times, h[State.waveKey], ci, State.waveKey);
    buildBars(h, ci);
    addLog(locName, usAqi, lat, lng);

    setStatus(`SCAN COMPLETE — US AQI ${usAqi} — ${lv.label}`, lv.lv >= 3 ? 'rd' : lv.lv >= 1 ? 'or' : 'gr');
    
    termLog(`SCAN OK — US AQI ${usAqi} [${lv.label}] — ${locName.split(',')[0]}`, 'system');

    // Location readout on the map, anchored to the marker.
    updatePopup(locName, lat, lng);
}

export function initTerminalTabs() {
    const tabs = document.querySelectorAll('.term-tab');
    const output = document.getElementById('terminal-output');
    const scanlog = document.getElementById('scan-log');
    const clearBtn = document.getElementById('clear-btn');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (target === 'output') {
                if (output) output.style.display = '';
                if (scanlog) scanlog.style.display = 'none';
                if (clearBtn) clearBtn.style.display = 'none';
            } else {
                if (output) output.style.display = 'none';
                if (scanlog) scanlog.style.display = '';
                if (clearBtn) clearBtn.style.display = '';
            }
        });
    });
}
