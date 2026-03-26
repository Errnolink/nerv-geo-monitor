/**
 * src/ui/status-bar.js — System Status & Error Display
 * Manages the topbar status text (#sys-stat) and the transient error
 * notification box (#err-box). Migrated from UICtrl.setStatus / UICtrl.showErr.
 */

import { $ } from '../state.js';

/**
 * Set the topbar system status text and LED colour class.
 *
 * @param {string} text   Status message to display (e.g. "SCAN COMPLETE").
 * @param {string} level  CSS level suffix: `'gr'` | `'or'` | `'rd'`
 */
export function setStatus(text, level) {
    const stat = $('sys-stat');
    if (stat) {
        stat.textContent = text;
    }
    const led = $('led');
    if (led) {
        led.className = 'led led-' + level;
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
        box.innerHTML = `<b>⚠ SYSTEM ERROR //</b> ${message}`;
        box.style.display = 'block';
        setTimeout(() => { box.style.display = 'none'; }, 5000);
    }
    setStatus('ERROR: ' + message.slice(0, 40), 'rd');
}
