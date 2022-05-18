import fetch from "cross-fetch";
import * as utils from "./utils";

export const githubOrigin = utils.envOverride(
  "GITHUB_URL",
  "https://github.com"
);
export const githubClientId = utils.envOverride(
  "GITHUB_CLIENT_ID",
  "e50d8f0c9f0679ab74d3"
);
export const githubClientSecret = utils.envOverride(
  "GITHUB_CLIENT_SECRET",
  "259dcadd5738a6f409bdf0a2c4790caf6eeb9055"
);
export const request = fetch;
