import clc from "cli-color";
import portfinder from "portfinder";
import { track } from "./track.js";
import fs from "fs";
import http from "http";
import { logger } from "./logger.js";
import path from "path";
import url from "url";
import util from "util";
import * as api from "./api.js";
import open from "open";
import { XLateError } from "./error.js";
import { LocalStorage } from "node-localstorage";
import { homedir } from "./utils.js";
import { getXlateDevOrigin, isSimulator } from "./firebase.js";
import { configstore } from "./configstore.js";
import { getDirname } from "./pkg.js";

const localStorageKey = `XLATE_${
  isSimulator ? "SIM_" : ""
}loginGithubWithCachedKey`;

const localStorage = new LocalStorage(`${homedir}/.xlate/storage`);

export interface User {
  email: string;

  iss?: string;
  azp?: string;
  aud?: string;
  sub?: number;
  hd?: string;
  email_verified?: boolean;
  at_hash?: string;
  iat?: number;
  exp?: number;
}

export interface Account {
  user: User;
  tokens: Tokens;
}

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

const GITHUB_SCOPES = ["read:user"];

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
    path.join(getDirname(), filename)
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
  const response = await api.request(`${getXlateDevOrigin()}/login`, {
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
  const cached: string = localStorage.getItem(localStorageKey) as string;
  if (cached) return cached;
  const port = await getPort();
  const newToken = await loginWithLocalhostGitHub(port);
  if (newToken) {
    localStorage.setItem(localStorageKey, newToken);
  }
  return newToken;
}

export function getGlobalDefaultAccount(): Account | undefined {
  const user = configstore.get("user") as User | undefined;
  const tokens = configstore.get("tokens") as Tokens | undefined;

  // TODO: Is there ever a case where only User or Tokens is defined
  //       and we want to accept that?
  if (!user || !tokens) {
    return undefined;
  }

  return {
    user,
    tokens,
  };
}

export function setGithubWithCachedKey(newToken: string) {
  localStorage.setItem(localStorageKey, newToken);
}
export function clearGithubWithCachedKey() {
  localStorage.setItem(localStorageKey, "");
}
