// read https://www.typescriptlang.org/docs/handbook/esm-node.html
import * as Configstore from "configstore";
import { isSimulator, pkg } from "./pkg";

export const configstore = new Configstore(
  pkg.name + (isSimulator ? "_SIM" : "")
);
