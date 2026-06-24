import { getEnv, isCloudflareRuntime } from "./runtime";

// 日志级别枚举
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// 从环境变量读取日志级别
function parseLogLevel(): LogLevel {
  const level = (getEnv("LOG_LEVEL") || "info").toLowerCase();
  switch (level) {
    case "error":
      return LogLevel.ERROR;
    case "warn":
      return LogLevel.WARN;
    case "info":
      return LogLevel.INFO;
    case "debug":
      return LogLevel.DEBUG;
    default:
      return LogLevel.INFO;
  }
}

let currentLogLevel: LogLevel = parseLogLevel();

// 允许动态更新日志级别
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

export function refreshLogLevelFromEnv(): void {
  currentLogLevel = parseLogLevel();
}

export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

// 基础日志输出
function log(level: LogLevel, levelName: string, ...args: any[]): void {
  if (level <= currentLogLevel) {
    const timestamp = new Date().toISOString();
    console[level === LogLevel.ERROR ? "error" : "log"](
      `[${timestamp}] [${levelName}]`,
      ...args,
    );
  }
}

export const logger = {
  error: (...args: any[]) => log(LogLevel.ERROR, "ERROR", ...args),
  warn: (...args: any[]) => log(LogLevel.WARN, "WARN", ...args),
  info: (...args: any[]) => log(LogLevel.INFO, "INFO", ...args),
  debug: (...args: any[]) => log(LogLevel.DEBUG, "DEBUG", ...args),
};

export class RequestLogger {
  private logDir: string;
  private requestId: string;
  private static _readOnlyChecked = false;
  private static _readOnly = false;

  constructor(requestId?: string) {
    this.requestId = requestId || this.generateRequestId();
    if (!RequestLogger._readOnlyChecked) {
      RequestLogger._readOnly = this.detectReadOnlyFs();
      RequestLogger._readOnlyChecked = true;
    }
    this.logDir = RequestLogger._readOnly ? "" : `logs/${this.requestId}`;
    if (!RequestLogger._readOnly) {
      logger.debug(`[RequestLogger] File logging disabled in this runtime: ${this.logDir}`);
    }
  }

  private detectReadOnlyFs(): boolean {
    if (isCloudflareRuntime()) {
      logger.info("[RequestLogger] Cloudflare runtime detected, file logging disabled");
      return true;
    }

    logger.info("[RequestLogger] File logging disabled for runtime portability");
    return true;
  }

  private get readOnly(): boolean {
    return RequestLogger._readOnly;
  }

  private generateRequestId(): string {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[-:T]/g, "")
      .replace(/\.\d{3}Z$/, "");
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${random}`;
  }

  getLogDir(): string {
    return this.logDir;
  }

  getRequestId(): string {
    return this.requestId;
  }

  saveRequestBody(body: any): void {
    if (currentLogLevel < LogLevel.DEBUG || this.readOnly) return;
    logger.debug("Request body:", body);
  }

  saveSSEDataLine(line: string): void {
    if (currentLogLevel < LogLevel.DEBUG || this.readOnly) return;
    logger.debug(`SSE line: ${line.substring(0, Math.min(50, line.length))}...`);
  }

  saveRawResponse(data: string): void {
    if (currentLogLevel < LogLevel.DEBUG || this.readOnly) return;
    logger.debug(`Raw response length: ${data.length}`);
  }
}

/**
 * 检查是否启用了调试日志
 */
export function isDebugEnabled(): boolean {
  return currentLogLevel >= LogLevel.DEBUG;
}
