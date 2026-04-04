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
import { renderData, clearLog, initMobileTabs } from './ui/panels.js';
import { updateWaveTabs, drawWave } from './ui/chart.js';

function parseCoords(s) {
    const m = s.trim().match(/^(-?\d+\.?\d*)\s*[,\s]+\s*(-?\d+\.?\d*)$/);
    return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
}

export async function doScan(lat, lng, name) {
    setStatus(`SCANNING ${name.split(',')[0].toUpperCase()}...`, 'or');
    if ($('sys-stat')) {
        $('sys-stat').textContent = 'SCANNING'; 
        $('sys-stat').style.color = 'var(--or)';
    }
    
    try {
        const [d, w] = await Promise.all([
            fetchAirQuality(lat, lng),
            fetchWeather(lat, lng).catch(e => null) // fail gracefully for weather
        ]);
        renderData(d, w, name, lat, lng);
    } catch (e) { 
        showErr(e.message); 
    }
}

export async function startScan(raw) {
    if (!raw) {
        showErr('Enter a location.');
        return;
    }
    try {
        const c = parseCoords(raw);
        if (c) {
            await doScan(c.lat, c.lng, `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
        } else {
            setStatus('GEOCODING...', 'or');
            const g = await geocode(raw);
            await doScan(g.lat, g.lng, g.name);
        }
    } catch (e) {
        showErr(e.message);
    }
}

function updateWaveSize() {
    const wi = $('wave-inner');
    if (!wi) return;
    const W = wi.clientWidth * State.waveScale;
    const svg = $('wave-svg');
    if (svg) svg.style.width = Math.max(600, W) + 'px';
    if (State.data && State.data.hourly) {
        drawWave(State.data.hourly.time, State.data.hourly[State.waveKey], State.ci, State.waveKey);
    }
}

async function init() {
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

    initClock();
    MapCtrl.init();
    initMobileTabs();

    const handleCommand = createCommandHandler({ doScan, startScan, clearLog });
    initTerminal(handleCommand);

    const clearBtn = $('clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', clearLog);

    window.addEventListener('scan-request', (e) => {
        doScan(e.detail.lat, e.detail.lng, e.detail.name);
    });

    document.querySelectorAll('.wtab').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!State.data) return;
            State.waveKey = btn.dataset.wk;
            updateWaveTabs();
            drawWave(State.data.hourly.time, State.data.hourly[State.waveKey], State.ci, State.waveKey);
        });
    });

    MapCtrl.onClick(async ({ lat, lng }) => {
        const inp = $('terminal-inp');
        if (inp) inp.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        await doScan(lat, lng, `${lat.toFixed(3)}, ${lng.toFixed(3)}`);
    });

    window.addEventListener('resize', () => {
        if (MapCtrl.map) MapCtrl.map.resize();
        updateWaveSize();
    });

    const wi = $('wave-inner');
    if (wi) {
        wi.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) > 0) {
                e.preventDefault();
                State.waveScale += e.deltaY * -0.002;
                State.waveScale = Math.max(1, Math.min(State.waveScale, 5));
                updateWaveSize();
            }
        }, { passive: false });

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
                updateWaveSize();
            }
        }, { passive: false });
    }

    setStatus('DETECTING LOCATION...', 'or');

    try {
        const gps = await getUserLocation();
        const locName = `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)} (GPS)`;
        const inp = $('terminal-inp');
        if (inp) inp.value = locName;
        await doScan(gps.lat, gps.lng, locName);
    } catch (e) {
        termLog("GPS unavailable, falling back to IP...", 'info');
        try {
            const d = await getIPLocation();
            const locName = d.city ? `${d.city}, ${d.region}` : 'Auto-Detected Location';
            const inp = $('terminal-inp');
            if (inp) inp.value = locName;
            await doScan(d.lat, d.lng, locName);
        } catch (err) {
            const inp = $('terminal-inp');
            if (inp) inp.value = 'Tokyo';
            await startScan('Tokyo');
        }
    }
}

window.addEventListener('load', init);
