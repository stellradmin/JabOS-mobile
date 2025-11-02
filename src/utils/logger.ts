/**
 * Production-ready logging service for Stellr
 * Replaces console.log statements with structured logging
 * Supports different log levels and production filtering
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private isProduction: boolean;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  private constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logLevel = this.isProduction ? LogLevel.WARN : LogLevel.DEBUG;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public getLogLevel(): LogLevel {
    return this.logLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private formatMessage(level: LogLevel, message: string, context?: string): string {
    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];
    const contextStr = context ? `[${context}]` : '';
    return `${timestamp} ${levelStr} ${contextStr} ${message}`;
  }

  private log(level: LogLevel, message: string, context?: string, data?: any, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data,
      error,
    };

    // Store log entry
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest log
    }

    // Output to console in development or for errors/warnings in production
    if (!this.isProduction || level <= LogLevel.WARN) {
      const formattedMessage = this.formatMessage(level, message, context);

      const logWith = (fn: (...args: any[]) => void, payload?: any, err?: Error) => {
        if (payload === undefined && err === undefined) {
          fn(formattedMessage);
        } else if (err !== undefined && payload !== undefined) {
          fn(formattedMessage, payload, err);
        } else if (payload !== undefined) {
          fn(formattedMessage, payload);
        } else {
          fn(formattedMessage, err);
        }
      };

      switch (level) {
        case LogLevel.ERROR:
          logWith(console.error, data, error);
          break;
        case LogLevel.WARN:
          logWith(console.warn, data);
          break;
        case LogLevel.INFO:
          logWith(console.info, data);
          break;
        case LogLevel.DEBUG:
        case LogLevel.TRACE:
          logWith(console.debug, data);
          break;
      }
    }
  }

  private parseArgs(args: any[]): { context?: string; data?: any; error?: Error } {
    let context: string | undefined;
    let data: any;
    let err: Error | undefined;
    for (const a of args) {
      if (typeof a === 'string') {
        context = a; // last string wins as context label
      } else if (a instanceof Error) {
        err = a;
      } else if (a !== undefined) {
        data = a;
      }
    }
    return { context, data, error: err };
  }

  public error(message: string, ...rest: any[]): void {
    const { context, data, error } = this.parseArgs(rest);
    this.log(LogLevel.ERROR, message, context, data, error);
  }

  public warn(message: string, ...rest: any[]): void {
    const { context, data } = this.parseArgs(rest);
    this.log(LogLevel.WARN, message, context, data);
  }

  public info(message: string, ...rest: any[]): void {
    const { context, data } = this.parseArgs(rest);
    this.log(LogLevel.INFO, message, context, data);
  }

  public debug(message: string, ...rest: any[]): void {
    const { context, data } = this.parseArgs(rest);
    this.log(LogLevel.DEBUG, message, context, data);
  }

  public trace(message: string, ...rest: any[]): void {
    const { context, data } = this.parseArgs(rest);
    this.log(LogLevel.TRACE, message, context, data);
  }

  // Utility methods for common use cases
  public apiCall(method: string, url: string, data?: any): void {
    this.debug(`API ${method} ${url}`, 'API', data);
  }

  public apiResponse(method: string, url: string, status: number, data?: any): void {
    if (status >= 400) {
      this.error(`API ${method} ${url} failed with status ${status}`, 'API', data);
    } else {
      this.debug(`API ${method} ${url} succeeded with status ${status}`, 'API', data);
    }
  }

  public navigation(from: string, to: string, params?: any): void {
    this.debug(`Navigation: ${from} -> ${to}`, 'Navigation', params);
  }

  public userAction(action: string, context?: string, data?: any): void {
    this.info(`User action: ${action}`, context || 'User', data);
  }

  public performance(operation: string, duration: number, context?: string): void {
    if (duration > 1000) {
      this.warn(`Slow operation: ${operation} took ${duration}ms`, context || 'Performance');
    } else {
      this.debug(`Operation: ${operation} took ${duration}ms`, context || 'Performance');
    }
  }

  // Get recent logs for debugging
  public getRecentLogs(count: number = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  // Clear logs
  public clearLogs(): void {
    this.logs = [];
  }

  // Get logs by level
  public getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Convenience exports
export const logError = (message: string, ...rest: any[]) => logger.error(message, ...rest);
export const logWarn = (message: string, ...rest: any[]) => logger.warn(message, ...rest);
export const logInfo = (message: string, ...rest: any[]) => logger.info(message, ...rest);
export const logDebug = (message: string, ...rest: any[]) => logger.debug(message, ...rest);
export const logTrace = (message: string, ...rest: any[]) => logger.trace(message, ...rest);

// Specialized logging functions
export const logApiCall = (method: string, url: string, data?: any) => 
  logger.apiCall(method, url, data);

export const logApiResponse = (method: string, url: string, status: number, data?: any) => 
  logger.apiResponse(method, url, status, data);

export const logNavigation = (from: string, to: string, params?: any) => 
  logger.navigation(from, to, params);

export const logUserAction = (action: string, context?: string, data?: any) => 
  logger.userAction(action, context, data);

export const logPerformance = (operation: string, duration: number, context?: string) => 
  logger.performance(operation, duration, context);

// Domain-specific convenience: Messaging logs
export const logMessaging = (message: string, data?: any) => logger.debug(message, 'MESSAGING', data);
