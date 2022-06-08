#!/usr/bin/env node
import clc from "cli-color";
import { Command } from "commander";
import { loginGithub } from "./auth.js";
import { configstore } from "./configstore.js";
import { XLateError } from "./error.js";
import { errorOut } from "./errorOut.js";
import { signinFirebase, signinFirebaseWithConfigstore } from "./firebase.js";
import { pkg } from "./pkg.js";
import { translate } from "./translate.js";

const program = new Command();

const AUTH_ERROR_MESSAGE = `Command requires authentication, please run ${clc.bold(
  "xlate login"
)}`;

const translateAction = async (_: any, command: Command) => {
  const args = command.args;
  const user = await signinFirebaseWithConfigstore();
  if (user) {
    const dir = process.cwd();
    translate(dir, args);
  } else {
    throw new XLateError(AUTH_ERROR_MESSAGE);
  }
};

program.option("-tk, --token [token]", "ci token");

program
  .name("xlate")
  .description("CLI to xlate translation tools")
  .version(pkg.version)
  .parse(process.argv)
  .action(translateAction);

program
  .command("login")
  .description("login with GitHub")
  .action(async () => {
    const user = await signinFirebaseWithConfigstore();
    if (!user) {
      const token = await loginGithub();
      await signinFirebase(token);
    }
  });

program
  .command("logout")
  .description("logout with GitHub")
  .action(async () => {
    configstore.delete("user");
  });

program.parse();

process.on("uncaughtException", function (err) {
  errorOut(err);
});
