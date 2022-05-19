import { uploadBytes } from "firebase/storage";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { getStorageRef, storage } from "./firebase";
import { logger } from "./logger";
const exec = promisify(require("child_process").exec);

async function scanDir(
  startPath: string,
  filter: string,
  cb: (dir: string) => Promise<void>
) {
  if (!fs.existsSync(startPath)) {
    console.log("no dir ", startPath);
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
  logger.info("looking for an .xcodeproj...");
  await scanDir(dir, ".xcodeproj", async (xcodeprojDir) => {
    const projectName = path.basename(xcodeprojDir, ".xcodeproj");
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
        const commandStr = [
          `xcodebuild -exportLocalizations -project "${xcodeprojDir}"`,
          `-localizationPath "/tmp/${projectName}"`,
          knownRegions.map((region) => `-exportLanguage ${region}`).join(" "),
        ].join(" ");
        logger.info(`exporting strings (.xcloc): ${knownRegions.join(" ")}`);
        const commandResult = await exec(commandStr, {
          maxBuffer: 1024 * 1024 * 100,
        });
        logger.info(`Compressing .xlocs: ${knownRegions.join(" ")}`);
        const tarCommand = await exec(
          `tar czvf /tmp/${projectName}.tgz /tmp/${projectName}/`
        );
        logger.info(tarCommand);

        /*
        const ref = getStorageRef(`zips/${projectName}.tgz`);

        const buf = fs.readFileSync(`/tmp/${projectName}.tgz`);

        await uploadBytes(ref, buf);
        logger.info("uploaded");
        */
      } else {
        logger.error(
          "Could not find knownRegions in your xcodeproj - try opening up the project in XCode and adding a target localization, then re-run xlate."
        );
      }
    });
  });
};
