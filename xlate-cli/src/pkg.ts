import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";

export const getFilename = () => fileURLToPath(import.meta.url);
export const getDirname = () => path.dirname(getFilename());

dotenv.config({ path: `${getDirname()}/../.env` });

const packageStr = fs.readFileSync(`${getDirname()}/../package.json`, "utf8");
const packageJson = JSON.parse(packageStr);

export const pkg = {
  version: packageJson.version ?? "",
  name: packageJson.name ?? "",
};

const { IS_SIMULATOR } = process.env;

export const isSimulator = IS_SIMULATOR === "true";
