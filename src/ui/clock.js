/**
 * src/ui/clock.js — Live Clock Display
 * Updates the #clk element every second with the current time.
 * Imported from state.js for the $ shorthand.
 */

import { $ } from '../state.js';

/**
 * Initialise the live clock. Updates `#clk` once immediately,
 * then every second thereafter with the current local time (24-hour).
 */
export function initClock() {
    const update = () => {
        const el = $('clk');
        if (el) el.textContent = new Date().toLocaleTimeString('en-GB', { hour12: false });
    };
    update();
    setInterval(update, 1000);
}
