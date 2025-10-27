import type { NextRequest } from "next/server"

type LogLevel = "info" | "warn" | "error"

type LogContext = {
  endpoint?: string
  clientIp?: string
  duration?: number
  error?: string
  codeLength?: number
  language?: string
  promptLength?: number
  [key: string]: any
}

class Logger {
  private isDev = process.env.NODE_ENV === "development"

  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? JSON.stringify(this.sanitizeContext(context)) : ""
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${contextStr}`.trim()
  }

  private sanitizeContext(context: LogContext): LogContext {
    const sanitized = { ...context }
    // Never log secrets, keys, or sensitive data
    const sensitiveKeys = ["key", "token", "secret", "password", "apiKey", "hfKey", "authorization"]
    sensitiveKeys.forEach((key) => {
      if (key in sanitized) {
        sanitized[key] = "***REDACTED***"
      }
    })
    return sanitized
  }

  info(message: string, context?: LogContext) {
    const log = this.formatLog("info", message, context)
    console.log(log)
  }

  warn(message: string, context?: LogContext) {
    const log = this.formatLog("warn", message, context)
    console.warn(log)
  }

  error(message: string, context?: LogContext) {
    const log = this.formatLog("error", message, context)
    console.error(log)
  }

  logRequest(req: NextRequest, context?: LogContext) {
    const method = req.method
    const url = new URL(req.url).pathname
    this.info(`${method} ${url}`, context)
  }
}

export const logger = new Logger()
