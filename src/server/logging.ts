// Structured logging utility
import * as fs from 'fs';
import * as path from 'path';

interface LogEntry {
    level: 'info' | 'warn' | 'error';
    message: string;
    timestamp: string;
    context?: Record<string, any>;
}

// Track logging failures to avoid spamming console
let logFileFailures = 0;
const MAX_LOG_FILE_FAILURES = 5;
const LOG_FILE = process.env.LOG_FILE || 'server.log';
const LOG_TO_FILE = process.env.LOG_TO_FILE !== 'false'; // Default true

export function log(level: LogEntry['level'], message: string, context?: Record<string, any>) {
    const entry: LogEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        context
    };

    // Log to console (always)
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleMethod(JSON.stringify(entry));

    // Log to file if enabled
    if (LOG_TO_FILE && logFileFailures < MAX_LOG_FILE_FAILURES) {
        try {
            const logMessage = `${entry.timestamp} [${level.toUpperCase()}] ${message}${context ? ' ' + JSON.stringify(context) : ''}\n`;
            fs.appendFileSync(LOG_FILE, logMessage);
            // Reset failure counter on success
            if (logFileFailures > 0) logFileFailures = 0;
        } catch (err) {
            logFileFailures++;
            // Log file write failure to console (but not repeatedly)
            if (logFileFailures === 1) {
                console.error(`[LOGGING] Failed to write to log file: ${err instanceof Error ? err.message : String(err)}`);
            } else if (logFileFailures === MAX_LOG_FILE_FAILURES) {
                console.error(`[LOGGING] Max log file failures (${MAX_LOG_FILE_FAILURES}) reached. File logging disabled for this session.`);
            }
        }
    }
}

// Convenience functions
export const logInfo = (message: string, context?: Record<string, any>) => log('info', message, context);
export const logWarn = (message: string, context?: Record<string, any>) => log('warn', message, context);
export const logError = (message: string, context?: Record<string, any>) => log('error', message, context);
