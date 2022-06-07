import fetch from "cross-fetch";
import * as utils from "./utils.js";

export const githubOrigin = utils.envOverride(
  "GITHUB_URL",
  "https://github.com"
);
export const githubClientId = utils.envOverride(
  "GITHUB_CLIENT_ID",
  "e50d8f0c9f0679ab74d3"
);
export const xlateDevOrigin = utils.envOverride(
  "XLATE_DEV_URL",
  "https://app.xlate.dev"
);
export const request = fetch;
