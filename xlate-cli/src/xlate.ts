import { Command } from "commander";
const program = new Command();

program
  .name("xlate-cli")
  .description("CLI to XLATE translation tools")
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

program.parse();
