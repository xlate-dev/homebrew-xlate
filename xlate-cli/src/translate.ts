import * as fs from "fs";
import * as path from "path";
import * as tar from "tar";
import { nanoid } from "nanoid";
import { promisify } from "util";
import {
  auth,
  getBucketStream,
  getStorageRef,
  listenToTask,
  uploadFile,
} from "./firebase";
import { logger } from "./logger";
import { tempdir } from "./utils";
import * as stream from "stream";
import { TranslationTask } from "./shared/xlate";
import * as child_process from "child_process";
import { errorOut } from "./errorOut";
import { promptOnce } from "./prompt";
import { langs } from "./langs";

const pipeline = promisify(stream.pipeline);

const exec = promisify(child_process.exec);

export interface TranslateResult {
  newArgs: string[];
}

async function scanDir(
  startPath: string,
  filter: string,
  cb: (dir: string) => Promise<void>
) {
  if (!fs.existsSync(startPath)) {
    logger.info("no dir " + startPath);
    return;
  }

  var files = fs.readdirSync(startPath);
  for (var i = 0; i < files.length; i++) {
    var filename = path.join(startPath, files[i]);
    var stat = fs.lstatSync(filename);
    if (filename.endsWith(filter)) {
      await cb(filename);
    } else if (stat.isDirectory()) {
      await scanDir(filename, filter, cb); //recurse
    }
  }
}

export const translate = async (
  dir: string,
  args: string[],
  silent: boolean = false
): Promise<TranslateResult> => {
  const start = Date.now();
  const newArgs: string[] = [];
  logger.info("looking for an .xcodeproj...");
  await scanDir(dir, ".xcodeproj", async (xcodeprojDir) => {
    const projectName = path.basename(xcodeprojDir, ".xcodeproj");
    const userId = auth.currentUser?.uid;
    if (!userId) throw "Unauthorized";
    const taskId: string = nanoid();
    logger.info("");
    logger.info(`analyzing ${projectName}`);
    try {
      await scanDir(xcodeprojDir, "project.pbxproj", async (pbxprojFile) => {
        const res = await exec(`plutil -convert json "${pbxprojFile}" -o -`);
        const resJSON = JSON.parse(res["stdout"]);
        const objects: any = resJSON["objects"];
        const keys: string[] = Object.keys(objects);
        let knownRegions: string[] = [];
        if (args && Array.isArray(args) && args.length > 0) {
          knownRegions = args;
        } else {
          keys.forEach((k) => {
            const entry: any = objects[k];
            const regions = entry["knownRegions"];
            if (regions && Array.isArray(regions)) {
              knownRegions = knownRegions.concat(regions);
            }
          });
        }

        // knownRegions = knownRegions.filter((r) => r === "Base");
        if (knownRegions.length) {
          const localPrefix = `${tempdir}/.xlate/data`;
          const relativeTaskPath = `xlate/${userId}/${taskId}`;
          const relativeXlocsPath = `${relativeTaskPath}/xclocs`;
          const relativeTranslatedXclocsPath = `${relativeTaskPath}/xclocs_translated`;
          const relativeTranslatedTgz = `${relativeTranslatedXclocsPath}.tgz`;
          const relativeTgzPath = `${relativeXlocsPath}.tgz`;
          const localTaskPath = `${localPrefix}/${relativeTaskPath}`;
          const localXlocsPath = `${localPrefix}/${relativeXlocsPath}`;
          const localTgzPath = `${localPrefix}/${relativeTgzPath}`;
          const localTranslatedPath = `${localPrefix}/${relativeTranslatedXclocsPath}`;
          const commandStr = [
            `xcodebuild -exportLocalizations -project "${xcodeprojDir}"`,
            `-localizationPath "${localXlocsPath}"`,
            knownRegions.map((region) => `-exportLanguage ${region}`).join(" "),
          ].join(" ");
          logger.debug(commandStr);
          logger.info(`exporting strings (.xcloc): ${knownRegions.join(" ")}`);
          const commandResult = await exec(commandStr, {
            maxBuffer: 1024 * 1024 * 100,
          });

          await pipeline(
            tar.c({ gzip: true, cwd: localXlocsPath }, ["."]),
            fs.createWriteStream(localTgzPath)
          );

          await new Promise<void>((resolve, reject) => {
            const unsubscribeFromTask = listenToTask(
              taskId,
              userId,
              (snapshot) => {
                snapshot.docChanges().forEach(async (change) => {
                  const doc: TranslationTask =
                    change.doc.data() as TranslationTask;
                  if (doc.status === "ERROR") {
                    logger.error("TASK ERROR");
                    unsubscribeFromTask();
                    reject();
                  }
                  if (change.type === "added") {
                    logger.info(`task id ${doc.id} started`);
                    logger.info(`task status: ${doc.status}`);
                  }
                  if (change.type === "modified") {
                    logger.info(`task status: ${doc.status}`);
                    if (doc.status === "COMPLETE") {
                      if (doc.languages && doc.languages.length > 0) {
                        logger.info(
                          `translations: ${doc.languages.join(", ")}`
                        );
                        const ref = getStorageRef(relativeTranslatedTgz);
                        const stream = getBucketStream(ref);

                        if (!fs.existsSync(localTranslatedPath)) {
                          fs.mkdirSync(localTranslatedPath, {
                            recursive: true,
                          });
                        }

                        await pipeline(
                          stream,
                          tar.x({
                            C: localTranslatedPath,
                          })
                        );

                        logger.info("Translations downloaded. importing...");

                        for (const l of doc.languages) {
                          await scanDir(
                            localTranslatedPath,
                            `${l}.xcloc`,
                            async (dir) => {
                              logger.info(`importing: ${path.basename(dir)}`);

                              const importCommandStr = `xcodebuild -importLocalizations -localizationPath "${dir}" -project "${xcodeprojDir}"`;
                              logger.debug(importCommandStr);
                              const importCommandResult = await exec(
                                importCommandStr,
                                {
                                  maxBuffer: 1024 * 1024 * 100,
                                }
                              );
                            }
                          );
                        }
                      } else {
                        logger.info("nothing translated");
                        if (!silent) {
                          const langChoice: string[] = await promptOnce({
                            type: "checkbox",
                            name: "language",
                            message:
                              "Please select new languages to translate:",
                            choices: langs.map((l) => ({
                              value: l.code,
                              name: l.name,
                            })),
                          });
                          langChoice.forEach((lc) => newArgs.push(lc));
                        }
                      }
                      logger.info("completed");
                      unsubscribeFromTask();
                      resolve();
                    }
                  }
                });
              }
            );
            (async () => {
              const uploadResult = await uploadFile(
                localTgzPath,
                relativeTgzPath,
                projectName
              );

              logger.info("strings uploaded to server");
            })();
          });
        } else {
          logger.error(
            `Could not find knownRegions in your ${projectName}.xcodeproj - try opening up the project in XCode and adding a target localization, then re-run xlate.`
          );
        }
      });
    } catch (e) {
      errorOut(e as Error, false);
    }
  });
  logger.info(`Time Taken to execute = ${(Date.now() - start) / 1000} seconds`);
  return {
    newArgs: newArgs,
  };
};
