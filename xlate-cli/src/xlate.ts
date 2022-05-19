#!/usr/bin/env node
import { Command } from "commander";
import { clearGithubWithCachedKey, loginGithubWithCachedKey } from "./auth";
import { signinFirebase } from "./firebase";
import { translate } from "./translate";
import { pkg } from "./utils";
const program = new Command();

program
  .name("xlate")
  .description("CLI to xlate translation tools")
  .version(pkg.version);

program
  .command("translate")
  .description("translate iOS project")
  .argument("[path]", "project path")
  .action(async (str, options) => {
    const token = await loginGithubWithCachedKey();
    try {
      const user = await signinFirebase(token);
      if (user) {
        const dir = str ?? process.cwd();
        translate(dir);
      }
    } catch (e) {
      clearGithubWithCachedKey();
    }
  });

program
  .command("login")
  .description("login with GitHub")
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
  .description("logout with GitHub")
  .action(async (str, options) => {
    clearGithubWithCachedKey();
  });

program.parse();
