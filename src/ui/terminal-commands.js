import { termLog, clearTerminal } from './terminal.js';

export function createCommandHandler(actions) {
    return async function handleCommand(raw) {
        const cmd = raw.toLowerCase().trim();
        
        if (cmd === 'help') {
            termLog('Available commands:', 'info');
            termLog('  <location>  Scan location by name (e.g., Tokyo)', 'info');
            termLog('  <lat,lng>   Scan location by coordinates', 'info');
            termLog('  clear       Clear terminal output', 'info');
            termLog('  clearlog    Clear scan log panel', 'info');
            termLog('Keys: / focus input · ↑↓ browse suggestions · Tab accept', 'info');
            return;
        }
        
        if (cmd === 'clear') {
            clearTerminal();
            return;
        }
        
        if (cmd === 'clearlog') {
            if (actions && actions.clearLog) {
                actions.clearLog();
                termLog('Scan log cleared.', 'system');
            }
            return;
        }
        
        const coordMatch = raw.trim().match(/^(-?\d+\.?\d*)\s*[,\s]+\s*(-?\d+\.?\d*)$/);
        if (coordMatch) {
            const lat = parseFloat(coordMatch[1]);
            const lng = parseFloat(coordMatch[2]);
            // Out-of-range coordinates otherwise reach the API and come back
            // as an opaque HTTP error.
            if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
                termLog(`ERR: coordinates out of range — lat ±90, lng ±180`, 'error');
                return;
            }
            termLog(`Initiating scan at coordinates: ${lat}, ${lng}`, 'info');
            if (actions?.startScan) await actions.startScan(raw);
            return;
        }

        // startScan is async — the previous try/catch wrapped the call without
        // awaiting it, so a rejected promise escaped it entirely.
        try {
            termLog(`Searching coordinates for: ${raw}...`, 'info');
            if (actions?.startScan) await actions.startScan(raw);
        } catch (e) {
            termLog(`ERR: UPLINK FAILED — ${e.message}`, 'error');
        }
    };
}
