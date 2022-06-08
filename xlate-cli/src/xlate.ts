#!/usr/bin/env node
import * as clc from "cli-color";
import { Command, OptionValues } from "commander";
import { loginGithub } from "./auth";
import { configstore } from "./configstore";
import { XLateError } from "./error";
import { errorOut } from "./errorOut";
import {
  signinWithConfigstore,
  signinWithGithubToken,
  signinWithRefreshToken,
} from "./firebase";
import { logger } from "./logger";
import { pkg } from "./pkg";
import { translate } from "./translate";

const program = new Command();

const AUTH_ERROR_MESSAGE = `Command requires authentication, please run ${clc.bold(
  "xlate login"
)}`;

const translateAction = async (
  args: string[],
  opts: OptionValues
  //command: Command
) => {
  const { token } = opts;
  const user = token
    ? await signinWithRefreshToken(token)
    : await signinWithConfigstore();
  if (user) {
    const dir = process.cwd();
    await translate(dir, args);
    process.exit(1);
  } else {
    throw new XLateError(AUTH_ERROR_MESSAGE);
  }
};

program
  .name("xlate")
  .argument("[langs...]")
  .description("automated translation for iOS developers")
  .version(pkg.version)
  .action(translateAction);

program.option("--token [token]", "supply an auth token for command");

program
  .command("login")
  .description("log the CLI into xlate with Github")
  .action(async () => {
    const user = await signinWithConfigstore();
    if (!user) {
      const token = await loginGithub();
      const user = await signinWithGithubToken(token);
      configstore.set("user", user.toJSON());
    }
  });

program
  .command("login:ci")
  .description(
    "generate an access token for use in non-interactive environments"
  )
  .action(async () => {
    const token = await loginGithub();
    const user = await signinWithGithubToken(token);
    logger.info(
      "Success! Use this token to login on a CI server:\n\n" +
        clc.bold(user.refreshToken) +
        '\n\nExample: xlate en --token "$XLATE_TOKEN"\n'
    );
  });

program
  .command("logout")
  .description("log the CLI out of xlate")
  .action(async () => {
    configstore.delete("user");
  });

program.parse(process.argv);

process.on("uncaughtException", function (err) {
  errorOut(err);
});
