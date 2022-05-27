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
import { homedir } from "./utils";
import * as stream from "stream";
import { TranslationTask } from "./shared/xlate";

const pipeline = promisify(stream.pipeline);

const exec = promisify(require("child_process").exec);

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
      scanDir(filename, filter, cb); //recurse
    }
  }
}

export const translate = async (dir: string) => {
  const start = Date.now();
  logger.info("looking for an .xcodeproj...");
  await scanDir(dir, ".xcodeproj", async (xcodeprojDir) => {
    const projectName = path.basename(xcodeprojDir, ".xcodeproj");
    const userId = auth.currentUser?.uid;
    if (!userId) throw "Unauthorized";
    const taskId: string = nanoid();
    logger.info(`analyzing ${projectName}`);
    await scanDir(xcodeprojDir, "project.pbxproj", async (pbxprojFile) => {
      const res = await exec(`plutil -convert json "${pbxprojFile}" -o -`);
      const resJSON = JSON.parse(res["stdout"]);
      const objects: any = resJSON["objects"];
      const keys: string[] = Object.keys(objects);
      let knownRegions: string[] = [];
      keys.forEach((k) => {
        const entry: any = objects[k];
        const regions = entry["knownRegions"];
        if (regions && Array.isArray(regions)) {
          knownRegions = knownRegions.concat(regions);
        }
      });
      // knownRegions = knownRegions.filter((r) => r === "Base");
      if (knownRegions.length) {
        const localPrefix = `${homedir}/.xlate/data`;
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
        logger.info(`exporting strings (.xcloc): ${knownRegions.join(" ")}`);
        const commandResult = await exec(commandStr, {
          maxBuffer: 1024 * 1024 * 100,
        });

        await pipeline(
          tar.c({ gzip: true, cwd: localXlocsPath }, ["."]),
          fs.createWriteStream(localTgzPath)
        );

        const unsubscribeFromTask = listenToTask(taskId, userId, (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            const doc: TranslationTask = change.doc.data() as TranslationTask;
            if (doc.status === "ERROR") {
              logger.error("TASK ERROR");
              unsubscribeFromTask();
              process.exit(-1);
            }
            if (change.type === "added") {
              logger.info(`task id ${doc.id} started`);
              logger.info(`task status: ${doc.status}`);
            }
            if (change.type === "modified") {
              logger.info(`task status: ${doc.status}`);
              if (doc.status === "COMPLETE") {
                const ref = getStorageRef(relativeTranslatedTgz);
                const stream = getBucketStream(ref);

                if (!fs.existsSync(localTranslatedPath)) {
                  fs.mkdirSync(localTranslatedPath, { recursive: true });
                }

                await pipeline(
                  stream,
                  tar.x({
                    C: localTranslatedPath,
                  })
                );

                logger.info("Translations downloaded. importing...");

                await scanDir(localTranslatedPath, ".xcloc", async (dir) => {
                  logger.info(`importing: ${path.basename(dir)}`);

                  const importCommandStr = `xcodebuild -importLocalizations -localizationPath "${dir}" -project "${xcodeprojDir}"`;

                  const importCommandResult = await exec(importCommandStr, {
                    maxBuffer: 1024 * 1024 * 100,
                  });
                });
                logger.info("copmpleted");
                logger.info(
                  `Time Taken to execute = ${
                    (Date.now() - start) / 1000
                  } seconds`
                );
                process.exit(1);
              }
            }
          });
        });

        const uploadResult = await uploadFile(
          localTgzPath,
          relativeTgzPath,
          projectName
        );

        logger.info("strings uploaded to server");
      } else {
        logger.error(
          "Could not find knownRegions in your xcodeproj - try opening up the project in XCode and adding a target localization, then re-run xlate."
        );
      }
    });
  });
};
