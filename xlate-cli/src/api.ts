import fetch from "cross-fetch";
import * as utils from "./utils";

export const githubOrigin = utils.envOverride(
  "GITHUB_URL",
  "https://github.com"
);
export const githubClientId = utils.envOverride(
  "GITHUB_CLIENT_ID",
  "89cf50f02ac6aaed3484"
);
export const githubClientSecret = utils.envOverride(
  "GITHUB_CLIENT_SECRET",
  "3330d14abc895d9a74d5f17cd7a00711fa2c5bf0"
);
export const request = fetch;
