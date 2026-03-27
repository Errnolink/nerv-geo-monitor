import { $, State } from '../state.js';

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
    
    while (out.childNodes.length > MAX_LINES) {
        out.removeChild(out.firstChild);
    }
    out.scrollTop = out.scrollHeight;
}

export function initTerminal(onCommand) {
    const inp = $('terminal-inp');
    if (!inp) return;
    
    inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const val = inp.value.trim();
            if (!val) return;
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
    termLog('Terminal cleared.', 'system');
}

export async function bootSequence(lines, delayMs = 80) {
    for (const line of lines) {
        termLog(line.text, line.type);
        await new Promise(r => setTimeout(r, delayMs));
    }
}
