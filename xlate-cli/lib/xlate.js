"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const auth_1 = require("./auth");
const program = new commander_1.Command();
program
    .name("xlate-cli")
    .description("CLI to XLate translation tools")
    .version("0.8.0");
program
    .command("translate")
    .description("translate ios project")
    .argument("<path>", "project path")
    .option("--debug", "display debug logging")
    .action((str, options) => {
    const optStr = options.debug ? "with debug" : "";
    console.log(`ok, project by path "${str}" will be translated ${optStr}`);
});
program
    .command("login")
    .description("login with github")
    .action((str, options) => {
    console.log("login");
    (0, auth_1.loginGithub)();
});
program.parse();
//# sourceMappingURL=xlate.js.map