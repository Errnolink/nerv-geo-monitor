/**
 * NERV AQI OPS CONSOLE v9.2
 * Refactored for modularity, caching, geolocation, and glitch transitions.
 */

const $ = id => document.getElementById(id);

// --- STATE & CONFIG ---
const State = {
    data: null,
    ci: null,
    scanLog: [],
    waveKey: 'us_aqi',
    waveScale: 1
};

const Config = {
    WAVE_COLS: { pm2_5: '#00E5FF', pm10: '#00E5FF', ozone: '#c8a0ff', nitrogen_dioxide: '#FFD740', sulphur_dioxide: '#FF8A00', carbon_monoxide: '#FF2A2A' },
    LVS: [
        { max: 50, lv: 0, label: 'NOMINAL', col: 'var(--gr)', cat: 'Good' },
        { max: 100, lv: 1, label: 'ACTIVE', col: 'var(--or)', cat: 'Moderate' },
        { max: 150, lv: 2, label: 'CAUTION', col: 'var(--or)', cat: 'Sensitive Groups' },
        { max: 200, lv: 3, label: 'ALERT', col: 'var(--rd)', cat: 'Unhealthy' },
        { max: 250, lv: 4, label: 'CRITICAL', col: 'var(--rd)', cat: 'Very Unhealthy' },
        { max: 999, lv: 5, label: 'HAZARD', col: 'var(--pu)', cat: 'Hazardous' },
    ],
    getLv: aqi => Config.LVS.find(l => aqi <= l.max) || Config.LVS[5],
    POL_KEYS: ['pm2_5', 'pm10', 'ozone', 'nitrogen_dioxide', 'sulphur_dioxide', 'carbon_monoxide'],
    PI: {
        pm2_5: { n: 'PM2.5', jp: '微粒子', u: 'μg/m³', who: 15, src: 'Vehicle exhaust, combustion, wildfires', fx: 'Penetrates deep into lungs; worsens cardiovascular and respiratory conditions.' },
        pm10: { n: 'PM10', jp: '粒子', u: 'μg/m³', who: 45, src: 'Road dust, construction, industrial', fx: 'Irritates airways; reduces lung function.' },
        ozone: { n: 'O₃', jp: 'オゾン', u: 'μg/m³', who: 100, src: 'NOx + VOC + sunlight (secondary)', fx: 'Inflames airways; reduces lung capacity.' },
        nitrogen_dioxide: { n: 'NO₂', jp: '二酸化窒素', u: 'μg/m³', who: 25, src: 'Vehicles, power plants', fx: 'Irritates lungs; increases infection risk.' },
        sulphur_dioxide: { n: 'SO₂', jp: '二酸化硫黄', u: 'μg/m³', who: 40, src: 'Coal, refineries, smelting', fx: 'Triggers asthma; forms acid rain.' },
        carbon_monoxide: { n: 'CO', jp: '一酸化炭素', u: 'μg/m³', who: 4000, src: 'Incomplete combustion, vehicles', fx: 'Reduces oxygen in blood.' },
    }
};

// --- DATA CACHE ---
const Cache = {
    data: new Map(),
    getKey(lat, lng) {
        return `${lat.toFixed(2)},${lng.toFixed(2)}`;
    },
    get(lat, lng) {
        const key = this.getKey(lat, lng);
        const entry = this.data.get(key);
        if (entry && (Date.now() - entry.ts < 15 * 60 * 1000)) return entry.res; // valid for 15 mins
        return null;
    },
    set(lat, lng, res) {
        this.data.set(this.getKey(lat, lng), { ts: Date.now(), res });
    }
};

// --- API MODULE ---
const API = {
    async fetchSuggestions(q) {
        try {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
            const data = await res.json();
            if (!data.results) return [];
            return data.results.map(r => ({ lat: r.latitude, lng: r.longitude, display: [r.name, r.admin1, r.country].filter(Boolean).join(', ') }));
        } catch { return []; }
    },
    
    async geocode(q) {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`);
        const d = await r.json();
        if (!d.results?.[0]) throw new Error('Location not found: ' + q);
        const res = d.results[0];
        return { lat: res.latitude, lng: res.longitude, name: [res.name, res.admin1, res.country].filter(Boolean).join(', ') };
    },

    async fetchAQ(lat, lng) {
        const cached = Cache.get(lat, lng);
        if (cached) return cached;
        const vars = ['pm2_5', 'pm10', 'carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone', 'us_aqi', 'european_aqi', 'uv_index'].join(',');
        const r = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&hourly=${vars}&timezone=auto&past_days=1&forecast_days=2`);
        if (!r.ok) throw new Error(`API HTTP ${r.status}`);
        const res = await r.json();
        Cache.set(lat, lng, res);
        return res;
    },

    async getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
            navigator.geolocation.getCurrentPosition(
                pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                err => reject(err),
                { timeout: 5000 }
            );
        });
    },

    async getIPLocation() {
        const r = await fetch('https://ipapi.co/json/');
        const d = await r.json();
        if (d.latitude && d.longitude) return { lat: d.latitude, lng: d.longitude, city: d.city, region: d.region_code || d.country_name };
        throw new Error('No coordinates returned from IP.');
    }
};

// --- MAP MODULE ---
const MapCtrl = {
    map: null,
    currentMarker: null,
    
    init() {
        this.map = new maplibregl.Map({
            container: 'map-wrap',
            style: {
                version: 8,
                sources: {
                    'carto-dark': {
                        type: 'raster',
                        tiles: ['https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '© CARTO'
                    }
                },
                layers: [{ id: 'osm-dark', type: 'raster', source: 'carto-dark', minzoom: 0, maxzoom: 19 }]
            },
            center: [78.49, 17.38],
            zoom: 11,
            attributionControl: false
        });
        
        this.map.on('click', (e) => {
            const lat = e.lngLat.lat, lng = e.lngLat.lng;
            $('loc-inp').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            App.doScan(lat, lng, `${lat.toFixed(3)}, ${lng.toFixed(3)}`);
        });
    },
    
    updateMarker(lat, lng, color) {
        if (this.currentMarker) this.currentMarker.remove();
        const el = document.createElement('div');
        el.className = 'nerv-marker';
        const cVal = getComputedStyle(document.documentElement).getPropertyValue(color.replace('var(', '').replace(')', '')).trim();
        el.innerHTML = `<div class="nerv-marker-ring" style="border-color: ${cVal}"></div><div class="nerv-marker-dot" style="background-color: ${cVal}; box-shadow: 0 0 10px ${cVal}"></div>`;
        this.currentMarker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(this.map);
        this.map.flyTo({ center: [lng, lat], zoom: this.map.getZoom() < 8 ? 10 : this.map.getZoom(), speed: 1.8, curve: 1 });
    }
};

// --- CHART MODULE ---
const ChartCtrl = {
    updateWaveTabs() {
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
    },

    drawWave(times, vals, ci, waveKey) {
        const svg = $('wave-svg'), W = svg.clientWidth || 800, H = svg.clientHeight || 70;
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = '';
        
        const isAqi = !waveKey || waveKey === 'us_aqi';
        const s = Math.max(0, ci - 23), e2 = Math.min(vals.length - 1, ci + 24);
        const sl = vals.slice(s, e2 + 1), tl = times.slice(s, e2 + 1), N = sl.length;
        if (N < 2) return;
        const pd = { l: 40, r: 20, t: 15, b: 24 };
        const iW = W - pd.l - pd.r, iH = H - pd.t - pd.b;
        const maxV = Math.max(...sl.filter(v => v != null), 150);
        const ys = v => v == null ? null : pd.t + iH - (v / (maxV * 1.15)) * iH;
        const xs = i => pd.l + (i / (N - 1)) * iW;
        const ni = ci - s, lv = Config.getLv(isAqi ? (sl[ni] || 0) : 50);

        let waveColHex = isAqi ? getComputedStyle(document.documentElement).getPropertyValue(lv.col.replace('var(', '').replace(')', '')).trim() : Config.WAVE_COLS[waveKey];
        const whoVal = (!isAqi && Config.PI[waveKey]?.who) ? Config.PI[waveKey].who : null;

        for (let gi = 0; gi <= 18; gi++) for (let gj = 0; gj <= 3; gj++) {
            const x = pd.l + (gi / 18) * iW, y = pd.t + (gj / 3) * iH;
            svg.innerHTML += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="10" fill="${waveColHex}" fill-opacity="0.15" text-anchor="middle" font-family="monospace">+</text>`;
        }

        tl.forEach((t, i) => {
            const dt = new Date(t);
            if (dt.getHours() === 5 && i > 0 && i < N) {
                const cx = xs(i).toFixed(1);
                svg.innerHTML += `<rect x="${cx - 10}" y="${pd.t}" width="20" height="${iH}" fill="#FF8A00" fill-opacity="0.05" />`;
                svg.innerHTML += `<line x1="${cx}" y1="${pd.t}" x2="${cx}" y2="${H - pd.b}" stroke="#FF8A00" stroke-opacity="0.4" stroke-width="1" stroke-dasharray="2,2"/>`;
                svg.innerHTML += `<text x="${cx}" y="${pd.t - 4}" font-size="9" fill="#FF8A00" fill-opacity="0.8" text-anchor="middle" font-family="IBM Plex Mono" font-weight="700">TGT</text>`;
            }
        });

        if (isAqi) {
            [50, 100, 150, 200, 250].forEach(v => {
                const y = ys(v); if (!y || y < pd.t) return;
                const c = v <= 50 ? '#50FF50' : v <= 150 ? '#FF8A00' : v <= 200 ? '#FF2A2A' : '#B020FF';
                svg.innerHTML += `<line x1="${pd.l}" y1="${y.toFixed(1)}" x2="${W - pd.r}" y2="${y.toFixed(1)}" stroke="${c}" stroke-opacity=".15" stroke-width="1" stroke-dasharray="4,4"/>
          <text x="${(pd.l - 6).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="11" fill="${c}" fill-opacity="0.5" text-anchor="end" font-family="IBM Plex Mono" font-weight="700">${v}</text>`;
            });
        } else {
            if (whoVal) {
                const yw = ys(whoVal); if (yw && yw >= pd.t)
                    svg.innerHTML += `<line x1="${pd.l}" y1="${yw.toFixed(1)}" x2="${W - pd.r}" y2="${yw.toFixed(1)}" stroke="#FF2A2A" stroke-opacity=".5" stroke-width="1" stroke-dasharray="4,3"/>
          <text x="${(pd.l - 6).toFixed(1)}" y="${(yw + 4).toFixed(1)}" font-size="11" fill="#FF2A2A" fill-opacity="0.8" text-anchor="end" font-family="IBM Plex Mono" font-weight="700">WHO</text>`;
            }
            const ym = ys(maxV); if (ym && ym >= pd.t)
                svg.innerHTML += `<text x="${(pd.l - 6).toFixed(1)}" y="${(ym + 4).toFixed(1)}" font-size="11" fill="${waveColHex}" fill-opacity="0.6" text-anchor="end" font-family="IBM Plex Mono">${maxV.toFixed(0)}</text>`;
        }

        svg.innerHTML += `<defs>
        <filter id="wg"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="wa" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${waveColHex}" stop-opacity="0.25"/><stop offset="100%" stop-color="${waveColHex}" stop-opacity="0"/></linearGradient>
      </defs>`;

        let ap = `M ${xs(0).toFixed(1)} ${H - pd.b}`;
        for (let i = 0; i <= ni; i++) { const y = ys(sl[i]); if (y != null) ap += ` L ${xs(i).toFixed(1)} ${y.toFixed(1)}`; }
        ap += ` L ${xs(ni).toFixed(1)} ${H - pd.b} Z`;
        svg.innerHTML += `<path d="${ap}" fill="url(#wa)"/>`;

        let pp = ''; for (let i = 0; i <= ni; i++) { const y = ys(sl[i]); if (y != null) pp += (pp ? 'L ' : 'M ') + `${xs(i).toFixed(1)} ${y.toFixed(1)} `; }
        svg.innerHTML += `<path d="${pp}" stroke="${waveColHex}" stroke-width="2" fill="none" filter="url(#wg)"/>`;

        let fp = ''; for (let i = ni; i < N; i++) { const y = ys(sl[i]); if (y != null) fp += (fp ? 'L ' : 'M ') + `${xs(i).toFixed(1)} ${y.toFixed(1)} `; }
        svg.innerHTML += `<path d="${fp}" stroke="${waveColHex}" stroke-width="1.5" fill="none" stroke-opacity="0.3" stroke-dasharray="4,4"/>`;

        const nx = xs(ni).toFixed(1);
        svg.innerHTML += `<line x1="${nx}" y1="${pd.t}" x2="${nx}" y2="${H - pd.b}" stroke="#fff" stroke-opacity="0.2" stroke-width="1"/>
      <rect x="${parseFloat(nx) - 15}" y="${H - pd.b}" width="30" height="14" fill="#fff" fill-opacity="0.1" />
      <text x="${nx}" y="${H - pd.b + 10}" font-size="9" fill="#fff" fill-opacity="0.8" text-anchor="middle" font-family="IBM Plex Mono" font-weight="700">NOW</text>`;

        tl.forEach((t, i) => {
            const h2 = new Date(t).getHours(); if (h2 % 6 !== 0) return;
            svg.innerHTML += `<text x="${xs(i).toFixed(1)}" y="${H - 5}" font-size="11" fill="var(--mid)" text-anchor="middle" font-family="IBM Plex Mono" font-weight="700">${String(h2).padStart(2, '0')}:00</text>`;
        });
    }
};

// --- UI MODULE ---
const UICtrl = {
    initClock() {
        setInterval(() => {
            const n = new Date();
            $('clk').textContent = n.toLocaleTimeString('en-GB', { hour12: false });
            $('sbar-r').textContent = n.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
        }, 1000);
    },

    setStatus(t, l) {
        $('sbar-s').textContent = t;
        $('led').className = 'led led-' + l;
    },

    showErr(m) {
        const e = $('err-box');
        e.innerHTML = `<b>⚠ SYSTEM ERROR //</b> ${m}`;
        e.style.display = 'block';
        setTimeout(() => e.style.display = 'none', 5000);
        this.setStatus('ERROR: ' + m.slice(0, 40), 'rd');
        $('scan-btn').disabled = false;
    },

    initMobileTabs() {
        const tabs = document.querySelectorAll('.mtab');
        
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
                setTimeout(() => { if (MapCtrl.map) MapCtrl.map.resize(); }, 50);
            });
        });
    },

    initAutocomplete() {
        const inp = $('loc-inp'), drop = $('ac-drop');
        let acTimer = null, acIdx = -1, acResults = [];

        const highlight = (q, name) => {
            const i = name.toLowerCase().indexOf(q.toLowerCase());
            if (i < 0) return name;
            return name.slice(0, i) + '<b>' + name.slice(i, i + q.length) + '</b>' + name.slice(i + q.length);
        };

        const renderDrop = () => {
            drop.innerHTML = '';
            acIdx = -1;
            if (!acResults.length) { drop.classList.remove('open'); return; }
            acResults.forEach((r, i) => {
                const d = document.createElement('div');
                d.className = 'ac-item';
                d.innerHTML = highlight(inp.value, r.display);
                d.onmousedown = e => { e.preventDefault(); pick(i); };
                d.onmouseover = () => { acIdx = i; refreshHi(); };
                drop.appendChild(d);
            });
            drop.classList.add('open');
        };

        const refreshHi = () => drop.querySelectorAll('.ac-item').forEach((el, i) => el.classList.toggle('hi', i === acIdx));

        const pick = (i) => {
            const r = acResults[i];
            inp.value = r.display;
            drop.classList.remove('open');
            acResults = [];
            App.doScan(r.lat, r.lng, r.display);
        };

        inp.addEventListener('input', () => {
            const q = inp.value.trim();
            clearTimeout(acTimer);
            if (q.length < 2 || App.parseCoords(q)) { drop.classList.remove('open'); return; }
            acTimer = setTimeout(async () => {
                acResults = await API.fetchSuggestions(q);
                renderDrop();
            }, 220);
        });

        inp.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); acIdx = Math.min(acIdx + 1, acResults.length - 1); refreshHi(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); acIdx = Math.max(acIdx - 1, 0); refreshHi(); }
            else if (e.key === 'Enter') {
                clearTimeout(acTimer);
                if (acIdx >= 0 && acResults.length) { e.preventDefault(); pick(acIdx); }
                else { drop.classList.remove('open'); acResults = []; App.startScan(); }
            }
            else if (e.key === 'Escape') { drop.classList.remove('open'); }
        });

        document.addEventListener('click', e => {
            if (!e.target.closest('#ac-wrap')) drop.classList.remove('open');
        });

        window.addEventListener('keydown', e => {
            if (e.key === '/' && document.activeElement !== $('loc-inp')) {
                e.preventDefault();
                $('loc-inp').focus();
            }
        });
    },

    buildBars(h, ci) {
        const row = $('vbars-row'); row.innerHTML = '';
        $('pol-detail').classList.remove('show');
        Config.POL_KEYS.forEach(k => {
            const p = Config.PI[k], val = h[k]?.[ci]; if (val == null) return;
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
                if (!was) {
                    w.classList.add('act');
                    $('pd-name').textContent = `${p.n} (${p.jp}) — ${v} ${p.u}`;
                    $('pd-who').className = `pd-val ${ex ? 'pd-who-ex' : 'pd-who-ok'}`;
                    $('pd-who').textContent = `${p.who} ${p.u} — ${ex ? `EXCEEDED +${Math.round((v / p.who - 1) * 100)}%` : 'WITHIN LIMITS'}`;
                    $('pd-src').textContent = p.src; $('pd-fx').textContent = p.fx;
                    det.classList.add('show');
                    det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else det.classList.remove('show');
            };
            row.appendChild(w);
        });
        requestAnimationFrame(() => requestAnimationFrame(() => {
            document.querySelectorAll('.vbf').forEach(b => b.style.height = b.dataset.p + '%');
        }));
    },
    
    addLog(nm, aqi, lat, lng) {
        if (State.scanLog.length > 0 && State.scanLog[0].nm === nm) return;
        State.scanLog.unshift({ nm, aqi, lat, lng, t: new Date() });
        if (State.scanLog.length > 14) State.scanLog.pop();
        this.renderLog();
    },

    renderLog() {
        const el = $('scan-log'); el.innerHTML = '';
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
                $('loc-inp').value = e.nm;
                App.doScan(e.lat, e.lng, e.nm);
            };
            el.appendChild(d);
        });
    },

    clearLog() { 
        State.scanLog = []; 
        this.renderLog(); 
    }
};

// --- APP ORCHESTRATOR ---
const App = {
    parseCoords(s) {
        const m = s.trim().match(/^(-?\d+\.?\d*)\s*[,\s]+\s*(-?\d+\.?\d*)$/);
        return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
    },

    currentIdx(times) {
        const n = new Date(), pad = x => String(x).padStart(2, '0'), t = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:00`;
        let b = 0;
        times.forEach((v, i) => { if (v <= t) b = i; });
        return b;
    },

    getDom(h, ci) {
        const m = { 'PM2.5': 'pm2_5', 'PM10': 'pm10', 'O₃': 'ozone', 'NO₂': 'nitrogen_dioxide', 'SO₂': 'sulphur_dioxide' };
        let best = null, bv = -1;
        Object.entries(m).forEach(([nm, k]) => {
            const p = Config.PI[k], v = h[k]?.[ci];
            if (v != null && p?.who) { const r = v / p.who; if (r > bv) { bv = r; best = nm; } }
        });
        return best || 'PM2.5';
    },

    renderData(data, locName, lat, lng) {
        State.data = data; 
        const h = data.hourly, times = h.time;
        State.ci = this.currentIdx(times); 
        const ci = State.ci;
        
        const usAqi = h.us_aqi[ci] ?? 0, euAqi = h.european_aqi[ci] ?? 0;
        const lv = Config.getLv(usAqi), dom = this.getDom(h, ci);
        const uv = h.uv_index?.[ci], now = new Date(times[ci]);

        document.body.className = `lv${lv.lv}`;
        document.documentElement.style.setProperty('--ac', lv.col);

        $('c-aqi').textContent = usAqi;
        $('c-stat').textContent = lv.label;
        $('c-cat').textContent = lv.cat.toUpperCase();
        $('c-stamp').textContent = lv.label;
        $('c-loc').textContent = locName.split(',').slice(0, 2).join(',');
        $('c-loc').style.color = lv.col;
        $('c-coords').textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        $('c-ts').textContent = now.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        $('c-dom').textContent = dom; $('c-eaqi').textContent = euAqi + ' (EU)';
        $('c-uv').textContent = uv != null ? `${uv.toFixed(1)} — ${uv < 3 ? 'LOW' : uv < 6 ? 'MODERATE' : uv < 8 ? 'HIGH' : 'VERY HIGH'}` : '—';

        const sevs = $('sev-row').children;
        for (let i = 0; i < 5; i++) sevs[i].style.background = i <= lv.lv ? 'var(--ac)' : 'var(--dim)';

        $('sys-stat').textContent = lv.label; $('sys-stat').style.color = 'var(--ac)';

        MapCtrl.updateMarker(lat, lng, lv.col);
        ChartCtrl.updateWaveTabs();
        ChartCtrl.drawWave(times, h[State.waveKey], ci, State.waveKey);
        UICtrl.buildBars(h, ci);
        UICtrl.addLog(locName, usAqi, lat, lng);
        UICtrl.setStatus(`SCAN COMPLETE — US AQI ${usAqi} — ${lv.label}`, lv.lv >= 3 ? 'rd' : lv.lv >= 1 ? 'or' : 'gr');
    },

    async doScan(lat, lng, name) {
        $('scan-btn').disabled = true;
        UICtrl.setStatus(`SCANNING ${name.split(',')[0].toUpperCase()}...`, 'or');
        $('sys-stat').textContent = 'SCANNING'; $('sys-stat').style.color = 'var(--or)';
        try {
            const d = await API.fetchAQ(lat, lng);
            this.renderData(d, name, lat, lng);
        } catch (e) { UICtrl.showErr(e.message) }
        $('scan-btn').disabled = false;
    },

    updateWaveSize() {
        const wi = $('wave-inner');
        const W = wi.clientWidth * State.waveScale;
        $('wave-svg').style.width = Math.max(600, W) + 'px';
        if (State.data) ChartCtrl.drawWave(State.data.hourly.time, State.data.hourly[State.waveKey], State.ci, State.waveKey);
    },

    async startScan() {
        const raw = $('loc-inp').value.trim(); if (!raw) { UICtrl.showErr('Enter a location.'); return }
        try {
            const c = this.parseCoords(raw);
            if (c) await this.doScan(c.lat, c.lng, `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
            else { 
                $('scan-btn').disabled = true; 
                UICtrl.setStatus('GEOCODING...', 'or'); 
                const g = await API.geocode(raw); 
                await this.doScan(g.lat, g.lng, g.name); 
            }
        } catch (e) { UICtrl.showErr(e.message); $('scan-btn').disabled = false }
    },

    async init() {
        UICtrl.initClock();
        MapCtrl.init();
        UICtrl.initAutocomplete();
        UICtrl.initMobileTabs();
        
        $('clear-btn').addEventListener('click', () => UICtrl.clearLog());
        $('scan-btn').addEventListener('click', () => this.startScan());

        document.querySelectorAll('.wtab').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!State.data) return;
                State.waveKey = btn.dataset.wk;
                ChartCtrl.updateWaveTabs();
                ChartCtrl.drawWave(State.data.hourly.time, State.data.hourly[State.waveKey], State.ci, State.waveKey);
            });
        });
        
        window.addEventListener('resize', () => { 
            if (MapCtrl.map) MapCtrl.map.resize();
            this.updateWaveSize(); 
        });

        const wi = $('wave-inner');
        wi.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) > 0) {
                e.preventDefault();
                State.waveScale += e.deltaY * -0.002;
                State.waveScale = Math.max(1, Math.min(State.waveScale, 5));
                this.updateWaveSize();
            }
        }, {passive: false});

        let initDist = 0, initScale = 1;
        wi.addEventListener('touchstart', e => {
            if (e.touches.length === 2) {
                initDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
                initScale = State.waveScale;
            }
        });
        wi.addEventListener('touchmove', e => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
                State.waveScale = initScale * (dist / initDist);
                State.waveScale = Math.max(1, Math.min(State.waveScale, 5));
                this.updateWaveSize();
            }
        }, {passive: false});

        UICtrl.setStatus('DETECTING LOCATION...', 'or');
        
        try {
            const gps = await API.getUserLocation();
            const locName = `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)} (GPS)`;
            $('loc-inp').value = locName;
            this.doScan(gps.lat, gps.lng, locName);
        } catch (e) {
            console.log("GPS unavailable, falling back to IP...", e);
            try {
                const d = await API.getIPLocation();
                const locName = d.city ? `${d.city}, ${d.region}` : 'Auto-Detected Location';
                $('loc-inp').value = locName;
                this.doScan(d.lat, d.lng, locName);
            } catch (err) {
                $('loc-inp').value = 'Tokyo'; 
                this.startScan();
            }
        }
    }
};

window.addEventListener('load', () => App.init());