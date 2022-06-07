// read https://www.typescriptlang.org/docs/handbook/esm-node.html
import Configstore from "configstore";
import { isSimulator } from "./firebase.js";

export const configstore = new Configstore(
  "pkg.name" + isSimulator ? "_SIM" : ""
);
