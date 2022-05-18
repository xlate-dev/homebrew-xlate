import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
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
  await scanDir(dir, ".xcodeproj", async (xcodeprojDir) => {
    const projectName = path.basename(xcodeprojDir, ".xcodeproj");
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
      if (knownRegions.length) {
        const commandStr = [
          `xcodebuild -exportLocalizations -project "${xcodeprojDir}"`,
          knownRegions.map((region) => `-exportLanguage ${region}`).join(" "),
          `/tmp/${projectName}`,
        ].join(" ");
        const commandResult = await exec(commandStr);
        console.log(commandResult);
      } else {
        console.log("NO REGIONS");
      }
    });
  });
};
