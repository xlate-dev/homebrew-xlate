import { XLateError } from "./error.js";
import logError from "./logError.js";

/**
 * Errors out by calling `process.exit` with an exit code of 2.
 * @param error an Error to be logged.
 */
export function errorOut(error: Error): void {
  let xlError: XLateError;
  if (error instanceof XLateError) {
    xlError = error;
  } else {
    xlError = new XLateError("An unexpected error has occurred.", {
      original: error,
      exit: 2,
    });
  }

  logError(xlError);
  process.exitCode = xlError.exit || 2;
  setTimeout(() => {
    process.exit();
  }, 250);
}
