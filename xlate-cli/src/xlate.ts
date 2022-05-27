#!/usr/bin/env node
import { Command } from "commander";
import { clearGithubWithCachedKey, loginGithubWithCachedKey } from "./auth";
import { signinFirebase } from "./firebase";
import { translate } from "./translate";
import { pkg } from "./utils";
const program = new Command();

const translateAction = async (str: string, options: any) => {
  const args = options.args;
  const token = await loginGithubWithCachedKey();
  try {
    const user = await signinFirebase(token);
    if (user) {
      let dir = "";
      const cwd = process.cwd();

      if (typeof str === "string") {
        dir = str ?? cwd;
      } else {
        dir = cwd;
      }
      translate(dir, args);
    }
  } catch (e) {
    console.error(e);
    clearGithubWithCachedKey();
  }
};

program
  .name("xlate")
  .description("CLI to xlate translation tools")
  .version(pkg.version)
  .option("-l")
  .parse(process.argv)
  .action(translateAction);

program
  .command("translate")
  .description("translate iOS project")
  .argument("[path]", "project path")
  .action(translateAction);

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
