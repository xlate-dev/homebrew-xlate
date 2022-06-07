#!/usr/bin/env node
import { Command } from "commander";
import { clearGithubWithCachedKey, loginGithubWithCachedKey } from "./auth.js";
import { errorOut } from "./errorOut.js";
import { signinFirebase } from "./firebase.js";
import { pkg } from "./pkg.js";
//import { requireAuth } from "./requireAuth.js";
import { translate } from "./translate.js";

const program = new Command();

const translateAction = async (_: any, command: Command) => {
  //requireAuth(command);
  const args = command.args;
  const token = await loginGithubWithCachedKey();
  try {
    const user = await signinFirebase(token);
    if (user) {
      const dir = process.cwd();
      translate(dir, args);
    }
  } catch (e) {
    console.error(e);
    clearGithubWithCachedKey();
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
    const token = await loginGithubWithCachedKey();
    try {
      const cred = await signinFirebase(token);
    } catch (e) {
      clearGithubWithCachedKey();
    }
  });

program
  .command("logout")
  .description("logout with GitHub")
  .action(async () => {
    clearGithubWithCachedKey();
  });

program.parse();

process.on("uncaughtException", function (err) {
  errorOut(err);
});
