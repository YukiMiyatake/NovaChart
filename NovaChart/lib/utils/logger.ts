/**
 * Logger utility
 * Provides unified logging interface with environment-based log level control
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment: boolean;
  private isServer: boolean;

  constructor() {
    // Check if we're in development mode
    this.isDevelopment = process.env.NODE_ENV === 'development';
    // Check if we're on the server side
    this.isServer = typeof window === 'undefined';
  }

  /**
   * Log debug message (only in development)
   */
  debug(...args: any[]): void {
    if (this.isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  }

  /**
   * Log info message
   */
  info(...args: any[]): void {
    console.log('[INFO]', ...args);
  }

  /**
   * Log warning message
   */
  warn(...args: any[]): void {
    console.warn('[WARN]', ...args);
  }

  /**
   * Log error message
   */
  error(...args: any[]): void {
    console.error('[ERROR]', ...args);
  }

  /**
   * Log with custom prefix
   */
  log(prefix: string, ...args: any[]): void {
    if (this.isDevelopment || prefix.includes('ERROR') || prefix.includes('WARN')) {
      console.log(`[${prefix}]`, ...args);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export Logger class for testing
export { Logger };

