#!/usr/bin/env node
import { Command } from "commander";
import { loginGithub } from "./auth";
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
  .action((str, options) => {
    console.log("login");
    loginGithub();
  });

program.parse();
