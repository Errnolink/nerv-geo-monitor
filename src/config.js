/**
 * src/config.js — Application Constants & Configuration
 * Migrated from monolithic app.js. All values are identical to the original.
 */

// --- WAVE COLOR MAP ---
/** Maps pollutant API keys to their chart waveform hex colors. */
export const Config = {
    WAVE_COLS: {
        pm2_5: '#00E5FF',
        pm10: '#00E5FF',
        ozone: '#c8a0ff',
        nitrogen_dioxide: '#FFD740',
        sulphur_dioxide: '#FF8A00',
        carbon_monoxide: '#FF2A2A',
    },

    // --- AQI LEVEL THRESHOLDS ---
    /** Ordered AQI severity bands. `getLv(aqi)` walks this list. */
    LVS: [
        { max: 50,  lv: 0, label: 'NOMINAL',  col: 'var(--gr)', cat: 'Good' },
        { max: 100, lv: 1, label: 'ACTIVE',   col: 'var(--or)', cat: 'Moderate' },
        { max: 150, lv: 2, label: 'CAUTION',  col: 'var(--or)', cat: 'Sensitive Groups' },
        { max: 200, lv: 3, label: 'ALERT',    col: 'var(--rd)', cat: 'Unhealthy' },
        { max: 250, lv: 4, label: 'CRITICAL', col: 'var(--rd)', cat: 'Very Unhealthy' },
        { max: 999, lv: 5, label: 'HAZARD',   col: 'var(--pu)', cat: 'Hazardous' },
    ],

    /**
     * Returns the AQI level object for a given AQI value.
     * @param {number} aqi
     * @returns {{ max: number, lv: number, label: string, col: string, cat: string }}
     */
    getLv: (aqi) => Config.LVS.find(l => aqi <= l.max) || Config.LVS[5],

    // --- POLLUTANT KEYS ---
    /** Ordered list of API keys for the six tracked pollutants. */
    POL_KEYS: ['pm2_5', 'pm10', 'ozone', 'nitrogen_dioxide', 'sulphur_dioxide', 'carbon_monoxide'],

    // --- POLLUTANT INFO ---
    /**
     * Per-pollutant metadata: display name, Japanese label, units,
     * WHO guideline threshold, source text, and health effect.
     */
    PI: {
        pm2_5: {
            n: 'PM2.5', jp: '微粒子', u: 'μg/m³', who: 15,
            src: 'Vehicle exhaust, combustion, wildfires',
            fx: 'Penetrates deep into lungs; worsens cardiovascular and respiratory conditions.',
        },
        pm10: {
            n: 'PM10', jp: '粒子', u: 'μg/m³', who: 45,
            src: 'Road dust, construction, industrial',
            fx: 'Irritates airways; reduces lung function.',
        },
        ozone: {
            n: 'O₃', jp: 'オゾン', u: 'μg/m³', who: 100,
            src: 'NOx + VOC + sunlight (secondary)',
            fx: 'Inflames airways; reduces lung capacity.',
        },
        nitrogen_dioxide: {
            n: 'NO₂', jp: '二酸化窒素', u: 'μg/m³', who: 25,
            src: 'Vehicles, power plants',
            fx: 'Irritates lungs; increases infection risk.',
        },
        sulphur_dioxide: {
            n: 'SO₂', jp: '二酸化硫黄', u: 'μg/m³', who: 40,
            src: 'Coal, refineries, smelting',
            fx: 'Triggers asthma; forms acid rain.',
        },
        carbon_monoxide: {
            n: 'CO', jp: '一酸化炭素', u: 'μg/m³', who: 4000,
            src: 'Incomplete combustion, vehicles',
            fx: 'Reduces oxygen in blood.',
        },
    },
};

// --- WMO WEATHER CODE LOOKUP ---
/**
 * Maps WMO weather interpretation codes (from Open-Meteo) to human-readable labels.
 * @type {Object<number, string>}
 */
export const WEATHER_CODES = {
    0:  'CLEAR SKY',
    1:  'MAINLY CLEAR',  2: 'PARTLY CLOUDY',     3: 'OVERCAST',
    45: 'FOG',           48: 'RIME FOG',
    51: 'LIGHT DRIZZLE', 53: 'MOD. DRIZZLE',     55: 'DENSE DRIZZLE',
    61: 'SLIGHT RAIN',   63: 'MOD. RAIN',         65: 'HEAVY RAIN',
    71: 'SLIGHT SNOW',   73: 'MOD. SNOW',          75: 'HEAVY SNOW',
    77: 'SNOW GRAINS',
    80: 'SLIGHT SHOWERS', 81: 'MOD. SHOWERS',    82: 'VIOLENT SHOWERS',
    85: 'SLIGHT SNOW SHWR', 86: 'HEAVY SNOW SHWR',
    95: 'THUNDERSTORM',  96: 'T-STORM W/ HAIL',  99: 'T-STORM W/ HEAVY HAIL',
};
