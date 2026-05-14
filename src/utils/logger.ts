import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";

// 日志级别枚举
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// 从环境变量读取日志级别
function parseLogLevel(): LogLevel {
  const level = (process.env.LOG_LEVEL || "info").toLowerCase();
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
    this.logDir = RequestLogger._readOnly ? "" : this.createLogDir();
    if (!RequestLogger._readOnly) {
      logger.debug(`[RequestLogger] Created log directory: ${this.logDir}`);
    }
  }

  private detectReadOnlyFs(): boolean {
    try {
      const testDir = path.join(process.cwd(), "logs", ".write_test");
      fs.mkdirSync(testDir, { recursive: true });
      fs.rmSync(testDir, { recursive: true, force: true });
      return false;
    } catch {
      logger.info("[RequestLogger] Filesystem is read-only, file logging disabled");
      return true;
    }
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

  private createLogDir(): string {
    const dir = path.join(process.cwd(), "logs", this.requestId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  getLogDir(): string {
    return this.logDir;
  }

  getRequestId(): string {
    return this.requestId;
  }

  saveRequestBody(body: any): void {
    if (currentLogLevel < LogLevel.DEBUG || this.readOnly) return;
    try {
      const filePath = path.join(this.logDir, "request.json");
      fs.writeFileSync(filePath, JSON.stringify(body, null, 2), "utf-8");
      logger.debug(`Request body saved to ${filePath}`);
    } catch (error) {
      logger.error("Failed to save request body:", error);
    }
  }

  saveSSEDataLine(line: string): void {
    if (currentLogLevel < LogLevel.DEBUG || this.readOnly) return;
    try {
      const filePath = path.join(this.logDir, "response.log");
      fs.appendFileSync(filePath, line + "\n", "utf-8");
      logger.debug(`SSE line saved: ${line.substring(0, Math.min(50, line.length))}...`);
    } catch (error) {
      logger.error("Failed to save SSE data line:", error);
    }
  }

  saveRawResponse(data: string): void {
    if (currentLogLevel < LogLevel.DEBUG || this.readOnly) return;
    try {
      const filePath = path.join(this.logDir, "response.json");
      fs.appendFileSync(filePath, data, "utf-8");
      logger.debug(`Raw response saved to ${filePath}, length: ${data.length}`);
    } catch (error) {
      logger.error("Failed to save response:", error);
    }
  }
}

/**
 * 检查是否启用了调试日志
 */
export function isDebugEnabled(): boolean {
  return currentLogLevel >= LogLevel.DEBUG;
}
