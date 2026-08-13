import { $, State } from '../state.js';
import { fetchSuggestions } from '../api/geocode.js';

const MAX_LINES = 200;

export function termLog(text, type = 'info') {
    const out = $('terminal-output');
    if (!out) return;
    const n = new Date();
    const pad = x => String(x).padStart(2, '0');
    const ts = `[${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}]`;

    const div = document.createElement('div');
    div.className = `terminal-line terminal-line--${type}`;
    div.textContent = `${ts} ${text}`;
    out.appendChild(div);

    State.terminalLines.push(`${ts} ${text}`);
    while (State.terminalLines.length > MAX_LINES) State.terminalLines.shift();

    while (out.childNodes.length > MAX_LINES) {
        out.removeChild(out.firstChild);
    }
    out.scrollTop = out.scrollHeight;
}

/* ================================================================
   AUTOCOMPLETE — the input placeholder advertises "Tab to autocomplete"
   and #term-autocomplete exists in the markup, but nothing was ever
   wired up and api/geocode.js#fetchSuggestions had no callers.
   ================================================================ */

let _suggestions = [];
let _sel = -1;
let _acTimer = null;

function _acBox() { return $('term-autocomplete'); }

function _hideAc() {
    _suggestions = [];
    _sel = -1;
    const box = _acBox();
    if (box) {
        box.style.display = 'none';
        box.innerHTML = '';
    }
}

function _renderAc(onPick) {
    const box = _acBox();
    if (!box) return;
    if (!_suggestions.length) return _hideAc();

    box.innerHTML = '';
    _suggestions.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = 'term-ac-item' + (i === _sel ? ' sel' : '');
        row.textContent = s.display;
        // mousedown, not click — click fires after the input blurs.
        row.addEventListener('mousedown', e => {
            e.preventDefault();
            onPick(s);
        });
        box.appendChild(row);
    });
    box.style.display = 'block';
}

function _moveSel(delta, onPick) {
    if (!_suggestions.length) return;
    _sel = (_sel + delta + _suggestions.length) % _suggestions.length;
    _renderAc(onPick);
}

export function initTerminal(onCommand) {
    const inp = $('terminal-inp');
    if (!inp) return;

    const pick = s => {
        inp.value = s.display;
        _hideAc();
        inp.focus();
    };

    const refresh = () => {
        const q = inp.value.trim();
        clearTimeout(_acTimer);
        // Don't geocode commands or raw coordinate pairs.
        if (q.length < 2 || /^[\d\s.,-]+$/.test(q) || ['help', 'clear', 'clearlog'].some(c => c.startsWith(q.toLowerCase()) && q.length < 4)) {
            return _hideAc();
        }
        _acTimer = setTimeout(async () => {
            const results = await fetchSuggestions(q);
            // The input may have moved on while the request was in flight.
            if (inp.value.trim() !== q) return;
            _suggestions = results;
            _sel = -1;
            _renderAc(pick);
        }, 220);
    };

    inp.addEventListener('input', refresh);
    inp.addEventListener('blur', () => setTimeout(_hideAc, 120));

    inp.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
            e.preventDefault();
            if (_suggestions.length) pick(_suggestions[_sel >= 0 ? _sel : 0]);
            return;
        }

        if (e.key === 'ArrowDown') { e.preventDefault(); return _moveSel(1, pick); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); return _moveSel(-1, pick); }

        if (e.key === 'Escape') { _hideAc(); return; }

        if (e.key === 'Enter') {
            // A highlighted suggestion commits itself first.
            if (_sel >= 0 && _suggestions[_sel]) {
                pick(_suggestions[_sel]);
                return;
            }
            const val = inp.value.trim();
            if (!val) return;
            _hideAc();
            termLog(`> ${val}`, 'system');
            inp.value = '';
            if (onCommand) onCommand(val);
        }
    });

    window.addEventListener('keydown', e => {
        if (e.key === '/' && document.activeElement !== inp) {
            e.preventDefault();
            inp.focus();
        }
    });
}

export function clearTerminal() {
    const out = $('terminal-output');
    if (out) out.innerHTML = '';
    State.terminalLines = [];
    termLog('Terminal cleared.', 'system');
}

export async function bootSequence(lines, delayMs = 80) {
    for (const line of lines) {
        termLog(line.text, line.type);
        await new Promise(r => setTimeout(r, delayMs));
    }
}
