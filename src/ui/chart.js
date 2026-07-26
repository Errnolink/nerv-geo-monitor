import { $, State } from '../state.js';
import { Config } from '../config.js';

export function updateWaveTabs() {
    document.querySelectorAll('.wtab').forEach(b => {
        if (b.dataset.wk === State.waveKey) {
            b.classList.add('on');
            const col = (State.waveKey === 'us_aqi') ? 'var(--ac)' : Config.WAVE_COLS[State.waveKey];
            b.style.backgroundColor = col;
            b.style.color = '#000';
            b.style.borderColor = col;
        } else {
            b.classList.remove('on');
            b.style.backgroundColor = 'transparent';
            b.style.color = 'var(--mid)';
            b.style.borderColor = 'var(--border)';
        }
    });
}

export function updateWeatherWaveTabs() {
    document.querySelectorAll('.wwtab').forEach(b => {
        const col = Config.WEATHER_WAVE_COLS[b.dataset.wwk] || '#20F0FF';
        if (b.dataset.wwk === State.weatherWaveKey) {
            b.classList.add('on');
            b.style.backgroundColor = col;
            b.style.color = '#000';
            b.style.borderColor = col;
        } else {
            b.classList.remove('on');
            b.style.backgroundColor = 'transparent';
            b.style.color = 'var(--mid)';
            b.style.borderColor = 'var(--border)';
        }
    });
}

/* ================================================================
   SHARED SVG UTILITIES — build strings first, set innerHTML once
   ================================================================ */
function _buildGridPluses(pd, iW, iH, col) {
    let s = '';
    for (let gi = 0; gi <= 14; gi++) {
        for (let gj = 0; gj <= 3; gj++) {
            const x = pd.l + (gi / 14) * iW, y = pd.t + (gj / 3) * iH;
            s += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="10" fill="${col}" fill-opacity="0.15" text-anchor="middle" font-family="monospace">+</text>`;
        }
    }
    return s;
}

function _buildTimeTicks(tl, xs, H) {
    let s = '';
    tl.forEach((t, i) => {
        const h = new Date(t).getHours();
        if (h % 6 !== 0) return;
        s += `<text x="${xs(i).toFixed(1)}" y="${H - 5}" font-size="11" fill="var(--mid)" text-anchor="middle" font-family="IBM Plex Mono" font-weight="700">${String(h).padStart(2, '0')}:00</text>`;
    });
    return s;
}

function _buildNowMarker(nx, pd, H) {
    return `<line x1="${nx}" y1="${pd.t}" x2="${nx}" y2="${H - pd.b}" stroke="#fff" stroke-opacity="0.2" stroke-width="1"/>
  <rect x="${parseFloat(nx) - 15}" y="${H - pd.b}" width="30" height="14" fill="#fff" fill-opacity="0.1" />
  <text x="${nx}" y="${H - pd.b + 10}" font-size="9" fill="#fff" fill-opacity="0.8" text-anchor="middle" font-family="IBM Plex Mono" font-weight="700">NOW</text>`;
}

function _buildPaths(sl, ni, N, xs, ys, waveColHex, pd, H) {
    let parts = '';
    // Area fill (past data)
    let ap = `M ${xs(0).toFixed(1)} ${H - pd.b}`;
    for (let i = 0; i <= ni; i++) { const y = ys(sl[i]); if (y != null) ap += ` L ${xs(i).toFixed(1)} ${y.toFixed(1)}`; }
    ap += ` L ${xs(ni).toFixed(1)} ${H - pd.b} Z`;
    parts += `<path d="${ap}" fill="url(#wa)"/>`;

    // Past line
    let pp = '';
    for (let i = 0; i <= ni; i++) { const y = ys(sl[i]); if (y != null) pp += (pp ? 'L ' : 'M ') + `${xs(i).toFixed(1)} ${y.toFixed(1)} `; }
    parts += `<path d="${pp}" stroke="${waveColHex}" stroke-width="2" fill="none" filter="url(#wg)"/>`;

    // Forecast line (dashed)
    let fp = '';
    for (let i = ni; i < N; i++) { const y = ys(sl[i]); if (y != null) fp += (fp ? 'L ' : 'M ') + `${xs(i).toFixed(1)} ${y.toFixed(1)} `; }
    parts += `<path d="${fp}" stroke="${waveColHex}" stroke-width="1.5" fill="none" stroke-opacity="0.3" stroke-dasharray="4,4"/>`;

    return parts;
}

function _buildDefs(waveColHex) {
    return `<defs>
    <filter id="wg"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="wa" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${waveColHex}" stop-opacity="0.25"/><stop offset="100%" stop-color="${waveColHex}" stop-opacity="0"/></linearGradient>
  </defs>`;
}

/* ================================================================
   AQI WAVEFORM CHART
   ================================================================ */
export function drawWave(times, vals, ci, waveKey) {
    const svg = $('wave-svg');
    if (!svg) return;
    const W = svg.clientWidth || 800;
    const H = svg.clientHeight || 70;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const isAqi = !waveKey || waveKey === 'us_aqi';
    const s = Math.max(0, ci - 23), e2 = Math.min(vals.length - 1, ci + 24);
    const sl = vals.slice(s, e2 + 1), tl = times.slice(s, e2 + 1), N = sl.length;
    if (N < 2) { svg.innerHTML = ''; return; }

    const pd = { l: 40, r: 20, t: 15, b: 24 };
    const iW = W - pd.l - pd.r, iH = H - pd.t - pd.b;
    const maxV = Math.max(...sl.filter(v => v != null), 150);
    const ys = v => v == null ? null : pd.t + iH - (v / (maxV * 1.15)) * iH;
    const xs = i => pd.l + (i / (N - 1)) * iW;
    const ni = ci - s, lv = Config.getLv(isAqi ? (sl[ni] || 0) : 50);

    let waveColHex = isAqi ? getComputedStyle(document.documentElement).getPropertyValue(lv.col.replace('var(', '').replace(')', '')).trim() : Config.WAVE_COLS[waveKey];
    const whoVal = (!isAqi && Config.PI[waveKey]?.who) ? Config.PI[waveKey].who : null;

    // Build entire SVG content as a single string
    let content = '';
    content += _buildGridPluses(pd, iW, iH, waveColHex);

    // Target areas (day boundaries)
    tl.forEach((t, i) => {
        const dt = new Date(t);
        if (dt.getHours() === 5 && i > 0 && i < N) {
            const cx = xs(i).toFixed(1);
            content += `<rect x="${cx - 10}" y="${pd.t}" width="20" height="${iH}" fill="#FF8A00" fill-opacity="0.05" />`;
            content += `<line x1="${cx}" y1="${pd.t}" x2="${cx}" y2="${H - pd.b}" stroke="#FF8A00" stroke-opacity="0.4" stroke-width="1" stroke-dasharray="2,2"/>`;
            content += `<text x="${cx}" y="${pd.t - 4}" font-size="9" fill="#FF8A00" fill-opacity="0.8" text-anchor="middle" font-family="IBM Plex Mono" font-weight="700">TGT</text>`;
        }
    });

    // Threshold lines
    if (isAqi) {
        [50, 100, 150, 200, 250].forEach(v => {
            const y = ys(v); if (!y || y < pd.t) return;
            const c = v <= 50 ? '#50FF50' : v <= 150 ? '#FF8A00' : v <= 200 ? '#FF2A2A' : '#B020FF';
            content += `<line x1="${pd.l}" y1="${y.toFixed(1)}" x2="${W - pd.r}" y2="${y.toFixed(1)}" stroke="${c}" stroke-opacity=".15" stroke-width="1" stroke-dasharray="4,4"/>
      <text x="${(pd.l - 6).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="11" fill="${c}" fill-opacity="0.5" text-anchor="end" font-family="IBM Plex Mono" font-weight="700">${v}</text>`;
        });
    } else {
        if (whoVal) {
            const yw = ys(whoVal); if (yw && yw >= pd.t) {
                content += `<line x1="${pd.l}" y1="${yw.toFixed(1)}" x2="${W - pd.r}" y2="${yw.toFixed(1)}" stroke="#FF2A2A" stroke-opacity=".5" stroke-width="1" stroke-dasharray="4,3"/>
      <text x="${(pd.l - 6).toFixed(1)}" y="${(yw + 4).toFixed(1)}" font-size="11" fill="#FF2A2A" fill-opacity="0.8" text-anchor="end" font-family="IBM Plex Mono" font-weight="700">WHO</text>`;
            }
        }
        const ym = ys(maxV); if (ym && ym >= pd.t) {
            content += `<text x="${(pd.l - 6).toFixed(1)}" y="${(ym + 4).toFixed(1)}" font-size="11" fill="${waveColHex}" fill-opacity="0.6" text-anchor="end" font-family="IBM Plex Mono">${maxV.toFixed(0)}</text>`;
        }
    }

    content += _buildDefs(waveColHex);
    content += _buildPaths(sl, ni, N, xs, ys, waveColHex, pd, H);
    content += _buildNowMarker(xs(ni).toFixed(1), pd, H);
    content += _buildTimeTicks(tl, xs, H);

    // Single DOM write — no reflows during construction
    svg.innerHTML = content;
}

/* ================================================================
   WEATHER WAVEFORM CHART
   ================================================================ */
export function drawWeatherWave(times, vals, ci, waveKey) {
    const svg = $('weather-wave-svg');
    if (!svg || !vals) return;
    const W = svg.clientWidth || 600;
    const H = svg.clientHeight || 70;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const s = Math.max(0, ci - 23), e2 = Math.min(vals.length - 1, ci + 24);
    const sl = vals.slice(s, e2 + 1), tl = times.slice(s, e2 + 1), N = sl.length;
    if (N < 2) { svg.innerHTML = ''; return; }

    const pd = { l: 40, r: 20, t: 15, b: 24 };
    const iW = W - pd.l - pd.r, iH = H - pd.t - pd.b;

    // For weather data, handle potential negative values (temperature)
    const filtered = sl.filter(v => v != null);
    const minV = Math.min(...filtered);
    const maxV = Math.max(...filtered);
    const range = maxV - minV || 1;
    const pad = range * 0.15;

    const ys = v => v == null ? null : pd.t + iH - ((v - minV + pad) / (range + pad * 2)) * iH;
    const xs = i => pd.l + (i / (N - 1)) * iW;
    const ni = ci - s;

    const waveColHex = Config.WEATHER_WAVE_COLS[waveKey] || '#20F0FF';
    const unit = Config.WEATHER_UNITS[waveKey] || '';

    let content = '';
    content += _buildGridPluses(pd, iW, iH, waveColHex);

    // Value axis labels (min, mid, max)
    const mid = (minV + maxV) / 2;
    [minV, mid, maxV].forEach(v => {
        const y = ys(v);
        if (y != null && y >= pd.t && y <= pd.t + iH) {
            content += `<line x1="${pd.l}" y1="${y.toFixed(1)}" x2="${W - pd.r}" y2="${y.toFixed(1)}" stroke="${waveColHex}" stroke-opacity=".1" stroke-width="1" stroke-dasharray="3,3"/>`;
            content += `<text x="${(pd.l - 6).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="10" fill="${waveColHex}" fill-opacity="0.5" text-anchor="end" font-family="IBM Plex Mono">${v.toFixed(v === Math.round(v) ? 0 : 1)}</text>`;
        }
    });

    // Current value label
    const curVal = sl[ni];
    if (curVal != null) {
        content += `<text x="${(W - pd.r + 4).toFixed(1)}" y="${pd.t + 10}" font-size="11" fill="${waveColHex}" fill-opacity="0.9" font-family="IBM Plex Mono" font-weight="700">${curVal.toFixed(1)}${unit}</text>`;
    }

    content += _buildDefs(waveColHex);
    content += _buildPaths(sl, ni, N, xs, ys, waveColHex, pd, H);
    content += _buildNowMarker(xs(ni).toFixed(1), pd, H);
    content += _buildTimeTicks(tl, xs, H);

    svg.innerHTML = content;
}
