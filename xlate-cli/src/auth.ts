import * as clc from "cli-color";
import * as portfinder from "portfinder";
import { track } from "./track";
import * as fs from "fs";
import * as http from "http";
import { logger } from "./logger";
import * as path from "path";
import * as url from "url";
import * as util from "util";
import * as api from "./api";
import * as open from "open";
import { XLateError } from "./error";
import { LocalStorage } from "node-localstorage";
import { homedir } from "./utils";

const localStorage = new LocalStorage(`${homedir}/.xlate/storage`);

// The wire protocol for an access token returned by Google.
// When we actually refresh from the server we should always have
// these optional fields, but when a user passes --token we may
// only have access_token.
export interface Tokens {
  id_token?: string;
  access_token: string;
  refresh_token?: string;
  scopes?: string[];
}

// https://docs.github.com/en/developers/apps/authorizing-oauth-apps
interface GitHubAuthResponse {
  access_token: string;
  scope: string;
  token_type: string;
}

const _nonce = Math.floor(Math.random() * (2 << 29) + 1).toString();
const getPort = portfinder.getPortPromise;

const GITHUB_SCOPES = ["read:user", "repo", "public_repo"];

function getCallbackUrl(port?: number): string {
  if (typeof port === "undefined") {
    return "urn:ietf:wg:oauth:2.0:oob";
  }
  return `http://localhost:${port}`;
}

function queryParamString(args: { [key: string]: string | undefined }) {
  const tokens: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string") {
      tokens.push(key + "=" + encodeURIComponent(value));
    }
  }
  return tokens.join("&");
}

function getGithubLoginUrl(callbackUrl: string) {
  return (
    api.githubOrigin +
    "/login/oauth/authorize?" +
    queryParamString({
      client_id: api.githubClientId,
      state: _nonce,
      redirect_uri: callbackUrl,
      scope: GITHUB_SCOPES.join(" "),
    })
  );
}

async function respondWithFile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  statusCode: number,
  filename: string
) {
  const response = await util.promisify(fs.readFile)(
    path.join(__dirname, filename)
  );
  res.writeHead(statusCode, {
    "Content-Length": response.length,
    "Content-Type": "text/html",
  });
  res.end(response);
  req.socket.destroy();
}

async function loginWithLocalhost<ResultType>(
  port: number,
  callbackUrl: string,
  authUrl: string,
  successTemplate: string,
  getTokens: (queryCode: string, callbackUrl: string) => Promise<ResultType>
): Promise<ResultType> {
  return new Promise<ResultType>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      let tokens: Tokens;
      const query = url.parse(`${req.url}`, true).query || {};
      const queryState = query.state;
      const queryCode = query.code;

      if (queryState !== _nonce || typeof queryCode !== "string") {
        await respondWithFile(req, res, 400, "../templates/loginFailure.html");
        reject(new XLateError("Unexpected error while logging in"));
        server.close();
        return;
      }

      try {
        const tokens = await getTokens(queryCode, callbackUrl);
        await respondWithFile(req, res, 200, successTemplate);
        resolve(tokens);
      } catch (err: any) {
        await respondWithFile(req, res, 400, "../templates/loginFailure.html");
        reject(err);
      }
      server.close();
      return;
    });

    server.listen(port, () => {
      logger.info();
      logger.info("Visit this URL on this device to log in:");
      logger.info(clc.bold.underline(authUrl));
      logger.info();
      logger.info("Waiting for authentication...");
      open(authUrl);
    });

    server.on("error", (err) => {
      reject(err);
    });
  });
}

async function getGithubTokensFromAuthorizationCode(
  code: string,
  callbackUrl: string
) {
  const response = await api.request(`${api.xlateDevOrigin}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "github",
      code,
    }),
  });
  const respJson = await response.json();
  return respJson["access_token"] as string;
}

async function loginWithLocalhostGitHub(port: number): Promise<string> {
  const callbackUrl = getCallbackUrl(port);
  const authUrl = getGithubLoginUrl(callbackUrl);
  const successTemplate = "../templates/loginSuccessGithub.html";
  const token = await loginWithLocalhost(
    port,
    callbackUrl,
    authUrl,
    successTemplate,
    getGithubTokensFromAuthorizationCode
  );
  void track("login", "google_localhost");
  return token;
}

export async function loginGithub(): Promise<string> {
  const port = await getPort();
  return loginWithLocalhostGitHub(port);
}

export async function loginGithubWithCachedKey(): Promise<string> {
  const cached: string = localStorage.getItem(
    "XLATE_loginGithubWithCachedKey"
  ) as string;
  if (cached) return cached;
  const port = await getPort();
  const newToken = await loginWithLocalhostGitHub(port);
  if (newToken) {
    localStorage.setItem("XLATE_loginGithubWithCachedKey", newToken);
  }
  return newToken;
}
export function setGithubWithCachedKey(newToken: string) {
  localStorage.setItem("XLATE_loginGithubWithCachedKey", newToken);
}
export function clearGithubWithCachedKey() {
  localStorage.setItem("XLATE_loginGithubWithCachedKey", "");
}
