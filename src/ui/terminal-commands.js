import { termLog } from './terminal.js';

export function createCommandHandler(actions) {
    return async function handleCommand(raw) {
        const cmd = raw.toLowerCase().trim();
        
        if (cmd === 'help') {
            termLog('Available commands:', 'info');
            termLog('  <location>  Scan location by name (e.g., Tokyo)', 'info');
            termLog('  <lat,lng>   Scan location by coordinates', 'info');
            termLog('  clear       Clear terminal output', 'info');
            termLog('  clearlog    Clear scan log panel', 'info');
            return;
        }
        
        if (cmd === 'clear') {
            const { clearTerminal } = await import('./terminal.js');
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
            termLog(`Initiating scan at coordinates: ${lat}, ${lng}`, 'info');
            if (actions && actions.startScan) {
                actions.startScan(raw);
            }
            return;
        }
        
        try {
            termLog(`Searching coordinates for: ${raw}...`, 'info');
            if (actions && actions.startScan) {
                actions.startScan(raw);
            }
        } catch (e) {
            termLog(`ERR: UPLINK FAILED — ${e.message}`, 'error');
        }
    };
}
