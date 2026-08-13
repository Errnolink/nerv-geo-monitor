/**
 * src/ui/status-bar.js — System Status & Error Display
 *
 * Drives three topbar elements:
 *   #sys-stat   — short one-word system state, sits inside "SYS: … // MAGI-01"
 *   #alert-text — the full human-readable status message
 *   #alert-led  — the alert LED colour/blink state
 *
 * Previously this wrote the full message into #sys-stat (blowing out the
 * "SYS: … // MAGI-01" line) and targeted a `#led` element that does not
 * exist in index.html, so the alert strip never changed.
 */

import { $ } from '../state.js';

/** Maps a level suffix to the short word shown in the SYS: readout. */
const SYS_WORD = {
    gr: 'NOMINAL',
    or: 'ACTIVE',
    rd: 'ALERT',
};

/** Maps a level suffix to the LED modifier class. */
const LED_CLASS = {
    gr: '',
    or: 'warn',
    rd: 'crit',
};

/**
 * Set the topbar system status text and LED colour class.
 *
 * @param {string} text   Status message to display (e.g. "SCAN COMPLETE").
 * @param {string} level  CSS level suffix: `'gr'` | `'or'` | `'rd'`
 */
export function setStatus(text, level = 'gr') {
    const lv = SYS_WORD[level] ? level : 'gr';

    const stat = $('sys-stat');
    if (stat) {
        stat.textContent = SYS_WORD[lv];
        stat.style.color = `var(--${lv})`;
    }

    const alertText = $('alert-text');
    if (alertText) {
        alertText.textContent = text;
        alertText.style.color = `var(--${lv})`;
    }

    const led = $('alert-led');
    if (led) {
        led.className = ('alert-led ' + LED_CLASS[lv]).trim();
    }
}

/**
 * Display a transient error notification in `#err-box` for 5 seconds,
 * then auto-hide it. Also updates the status bar to indicate an error.
 *
 * @param {string} message  Human-readable error message.
 */
export function showErr(message) {
    const box = $('err-box');
    if (box) {
        // Built as nodes, not innerHTML: `message` carries raw terminal input
        // back from the geocoder ("Location not found: <query>").
        box.replaceChildren(
            Object.assign(document.createElement('b'), { textContent: '⚠ SYSTEM ERROR //' }),
            document.createTextNode(' ' + message),
        );
        box.style.display = 'block';
        clearTimeout(showErr._t);
        showErr._t = setTimeout(() => { box.style.display = 'none'; }, 5000);
    }
    setStatus('ERROR: ' + message.slice(0, 40), 'rd');
}
