import * as winston from "winston";
import * as Transport from "winston-transport";
import { strip } from "cli-color";
import * as path from "path";
import * as fs from "fs";
import * as utils from "./utils";

export type LogLevel =
  | "error"
  | "warn"
  | "help"
  | "data"
  | "info"
  | "debug"
  | "prompt"
  | "http"
  | "verbose"
  | "input"
  | "silly";

// Extend the Winston log methods to support error signatures
export interface LogMethod extends winston.LogMethod {
  (level: LogLevel, err: Error, ...meta: any[]): Logger;
}

export interface LeveledLogMessage extends winston.LeveledLogMethod {
  // We use empty log messages to create newlines
  (): Logger;

  // We transform Errors to strings dynamically
  (err: Error, ...meta: any[]): Logger;
}

export interface Logger {
  log: LogMethod;

  error: LeveledLogMessage;
  warn: LeveledLogMessage;
  help: LeveledLogMessage;
  data: LeveledLogMessage;
  info: LeveledLogMessage;
  debug: LeveledLogMessage;
  prompt: LeveledLogMessage;
  http: LeveledLogMessage;
  verbose: LeveledLogMessage;
  input: LeveledLogMessage;
  silly: LeveledLogMessage;

  add(transport: Transport): Logger;
  remove(transport: Transport): Logger;
}

function expandErrors(logger: winston.Logger): winston.Logger {
  const oldLogFunc: winston.LogMethod = logger.log.bind(logger);
  const newLogFunc: winston.LogMethod = function (
    levelOrEntry: string | winston.LogEntry,
    message?: string | Error,
    ...meta: any[]
  ): winston.Logger {
    if (message && message instanceof Error) {
      message = message.stack || message.message;
      return oldLogFunc(levelOrEntry as string, message, ...meta);
    }
    // Overloads are weird in TypeScript. This method works so long as the original
    // function isn't checking arguments.length.
    return oldLogFunc(levelOrEntry as string, message as string, ...meta);
  };
  logger.log = newLogFunc;
  return logger;
}

function annotateDebugLines(logger: winston.Logger): winston.Logger {
  const debug: winston.LeveledLogMethod = logger.debug.bind(logger);
  const newDebug: winston.LeveledLogMethod = function (
    message: string | any,
    ...meta: any[]
  ): winston.Logger {
    if (typeof message === "string") {
      message = `[${new Date().toISOString()}] ${message || ""}`;
    }
    return debug(message, ...meta);
  };
  logger.debug = newDebug;
  return logger;
}

const rawLogger = winston.createLogger();
// Set a default silent logger to suppress logs during tests
rawLogger.add(
  new winston.transports.Console({
    /*silent: true, */
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf((info) => {
        // return `${info.level}: ${info.message}`;
        return `${info.message}`;
      })
    ),
  })
);
rawLogger.exitOnError = false;

function findAvailableLogFile() {
  const candidates = ["xlate-debug.log"];
  for (let i = 1; i < 10; i++) {
    candidates.push(`xlate-debug.${i}.log`);
  }

  for (const c of candidates) {
    const logFilename = path.join(process.cwd(), c);

    try {
      const fd = fs.openSync(logFilename, "r+");
      fs.closeSync(fd);
      return logFilename;
    } catch (e) {
      if ((e as any).code === "ENOENT") {
        // File does not exist, which is fine
        return logFilename;
      }

      // Any other error (EPERM, etc) means we won't be able to log to
      // this file so we skip it.
    }
  }

  throw new Error("Unable to obtain permissions for firebase-debug.log");
}

const logFilename = findAvailableLogFile();

// The type system for TypeScript is a bit wonky. The type of winston.LeveledLogMessage
// and winston.LogMessage is an interface of function overloads. There's no easy way to
// extend that and also subclass Logger to change the return type of those methods to
// allow error parameters.
// Casting looks super dodgy, but it should be safe because we know the underlying code
// handles all parameter types we care about.
export const logger = expandErrors(rawLogger) as unknown as Logger;

logger.add(
  new winston.transports.File({
    level: "debug",
    filename: logFilename,
    format: winston.format.printf((info) => {
      const segments = [info.message /*, ...(info[SPLAT] || [])*/].map(
        utils.tryStringify
      );
      return `[${Date.now()}]-[${info.level}] ${strip(segments.join(" "))}`;
    }),
  })
);
