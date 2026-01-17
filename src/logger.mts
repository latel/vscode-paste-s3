import * as vscode from 'vscode';

/**
 * Log levels for output
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * Centralized logger that writes to VSCode Output channel
 * Provides structured logging with timestamps and log levels
 */
export class Logger {
    private static instance: Logger;
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel = LogLevel.INFO;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Paste and Upload');
    }

    /**
     * Get the singleton logger instance
     */
    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Set the minimum log level for output
     */
    public setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    /**
     * Format a log message with timestamp and level
     */
    private format(level: string, message: string, ...args: any[]): string {
        const timestamp = new Date().toISOString();
        const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ') : '';
        return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
    }

    /**
     * Log a debug message
     */
    public debug(message: string, ...args: any[]): void {
        if (this.logLevel <= LogLevel.DEBUG) {
            const formatted = this.format('DEBUG', message, ...args);
            this.outputChannel.appendLine(formatted);
            console.log(formatted);
        }
    }

    /**
     * Log an info message
     */
    public info(message: string, ...args: any[]): void {
        if (this.logLevel <= LogLevel.INFO) {
            const formatted = this.format('INFO', message, ...args);
            this.outputChannel.appendLine(formatted);
            console.log(formatted);
        }
    }

    /**
     * Log a warning message
     */
    public warn(message: string, ...args: any[]): void {
        if (this.logLevel <= LogLevel.WARN) {
            const formatted = this.format('WARN', message, ...args);
            this.outputChannel.appendLine(formatted);
            console.warn(formatted);
        }
    }

    /**
     * Log an error message
     */
    public error(message: string, error?: any): void {
        if (this.logLevel <= LogLevel.ERROR) {
            let formatted = this.format('ERROR', message);
            if (error) {
                if (error instanceof Error) {
                    formatted += `\n  Error: ${error.message}`;
                    if (error.stack) {
                        formatted += `\n  Stack: ${error.stack}`;
                    }
                } else {
                    formatted += `\n  ${JSON.stringify(error)}`;
                }
            }
            this.outputChannel.appendLine(formatted);
            console.error(formatted);
        }
    }

    /**
     * Show the output channel
     */
    public show(): void {
        this.outputChannel.show();
    }

    /**
     * Dispose of the output channel
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}

/**
 * Get the shared logger instance
 */
export function getLogger(): Logger {
    return Logger.getInstance();
}
