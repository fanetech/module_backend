type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: any;
}

class Logger {
  private logLevel: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const message = entry.message;
    
    if (this.isDevelopment) {
      return `[${timestamp}] ${level} ${message}`;
    }
    
    return JSON.stringify({
      timestamp,
      level: entry.level,
      message,
      data: entry.data
    });
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      data
    };

    const formattedMessage = this.formatMessage(entry);

    switch (level) {
      case 'debug':
        console.debug(formattedMessage, data || '');
        break;
      case 'info':
        console.log(formattedMessage, data || '');
        break;
      case 'warn':
        console.warn(formattedMessage, data || '');
        break;
      case 'error':
        console.error(formattedMessage, data || '');
        break;
    }
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  // Méthode pour logger les requêtes HTTP
  logRequest(method: string, url: string, statusCode?: number, duration?: number): void {
    const message = `${method} ${url} ${statusCode || ''} ${duration ? `${duration}ms` : ''}`.trim();
    
    if (statusCode && statusCode >= 400) {
      this.error(message);
    } else {
      this.info(message);
    }
  }

  // Méthode pour logger les événements WebSocket
  logSocketEvent(event: string, socketId: string, data?: any): void {
    this.debug(`Socket [${socketId}] ${event}`, data);
  }
}

export const logger = new Logger();
