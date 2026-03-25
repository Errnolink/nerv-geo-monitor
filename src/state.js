/**
 * src/state.js — Global Application State
 * Central mutable state container for the NERV Geo-Monitor.
 * All modules import and read/write to this shared object.
 */

/**
 * Global reactive state singleton.
 * Modules import `State` directly and mutate its properties;
 * no framework reactivity — modules call each other explicitly.
 */
export const State = {
    /** @type {Object|null} Most recent API response from air-quality endpoint */
    data: null,

    /** @type {Object|null} Most recent weather API response */
    weather: null,

    /** @type {number|null} Current hour index into the hourly arrays */
    ci: null,

    /** @type {Array<Object>} Scan history log entries */
    scanLog: [],

    /** @type {string} Currently selected waveform data key */
    waveKey: 'us_aqi',

    /** @type {number} Current waveform zoom scale factor */
    waveScale: 1,

    /** @type {Array<string>} Terminal output line history */
    terminalLines: [],
};

/**
 * Shorthand DOM element selector by ID.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export const $ = (id) => document.getElementById(id);
