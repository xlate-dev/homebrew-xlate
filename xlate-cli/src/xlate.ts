#!/usr/bin/env node
import { Command } from "commander";
import { clearGithubWithCachedKey, loginGithubWithCachedKey } from "./auth";
import { signinFirebase } from "./firebase";
import { translate } from "./translate";
import { pkg } from "./utils";
const program = new Command();

program
  .name("xlate")
  .description("CLI to XLate translation tools")
  .version(pkg.version);

program
  .command("translate")
  .description("translate ios project")
  .argument("[path]", "project path")
  .action((str, options) => {
    const dir = str ?? process.cwd();
    translate(dir);
  });

program
  .command("login")
  .description("login with github")
  .action(async (str, options) => {
    const token = await loginGithubWithCachedKey();
    try {
      await signinFirebase(token);
    } catch (e) {
      clearGithubWithCachedKey();
    }
  });

program
  .command("logout")
  .description("logout with github")
  .action(async (str, options) => {
    clearGithubWithCachedKey();
  });

program.parse();
