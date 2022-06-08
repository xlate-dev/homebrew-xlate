import { logger } from "./logger";
import * as clc from "cli-color";
import { XLateError } from "./error";

export default function (error: XLateError) {
  if (error.children && error.children.length) {
    logger.error(
      [clc.bold.red("Error:"), clc.underline(error.message) + ":"].join(" ")
    );
    error.children.forEach(function (child: any) {
      var out = "- ";
      if (child.name) {
        out += clc.bold(child.name) + " ";
      }
      out += child.message;

      logger.error(out);
    });
  } else {
    if (error.original) {
      logger.error(error.original.stack);
    }
    logger.error([clc.bold.red("Error:"), error.message].join(" "));
  }
  if (error.context) {
    logger.debug("Error Context:", JSON.stringify(error.context, undefined, 2));
  }
}
