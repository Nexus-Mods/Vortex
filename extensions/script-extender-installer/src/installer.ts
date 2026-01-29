import * as path from "path";
import { types, util } from "vortex-api";
import supportData from "./gameSupport";
import { getScriptExtenderVersion } from "./util";

function testSupported(
  files: string[],
  gameId: string,
): Promise<types.ISupportedResult> {
  return new Promise((resolve, reject) => {
    if (!supportData[gameId]) {
      return resolve({ supported: false, requiredFiles: [] });
    } // Not a script extender friendly game.
    const scriptExtender = files.find(
      (file) => path.basename(file) === supportData[gameId].scriptExtExe,
    );
    resolve({ supported: scriptExtender ? true : false, requiredFiles: [] });
  });
}

async function installScriptExtender(
  files: string[],
  destinationPath: string,
  gameId: string,
): Promise<types.IInstallResult> {
  // Install the script extender.
  const gameData = supportData[gameId];
  const scriptExtender = files.find(
    (file) =>
      path.basename(file).toLowerCase() === gameData.scriptExtExe.toLowerCase(),
  );
  if (!scriptExtender)
    throw new util.DataInvalid(
      `Could not locate ${gameData.scriptExtExe} in the mod archive.`,
    );
  const idx = scriptExtender.indexOf(path.basename(scriptExtender));
  const rootPath = path.dirname(scriptExtender);

  // Get the attribute data we need.
  const scriptExtenderVersion = await getScriptExtenderVersion(
    path.join(destinationPath, scriptExtender),
  );
  const attributes = gameData.attributes(scriptExtenderVersion);
  // Include rules to make this conflict with any other script extender versions.
  attributes.push({
    type: "rule",
    rule: {
      reference: {
        logicalFileName: gameData.name,
        versionMatch: `<${scriptExtenderVersion} || >${scriptExtenderVersion}`,
      },
      type: "conflicts",
      comment: "Incompatible Script Extender",
    },
  });

  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter(
    (file) => file.indexOf(rootPath) !== -1 && !file.endsWith(path.sep),
  );

  // Build install instructions and attach attributes to it.
  const instructions: types.IInstruction[] = filtered
    .map((file) => {
      const copy: types.IInstruction = {
        type: "copy" as "copy",
        source: file,
        destination: path.join(file.substr(idx)),
      };
      return copy;
    })
    .concat(attributes);

  // TODO: remove this once we had a chance to fix the modtypes conflict issue
  //  and have re-instated the script-extender modtype.
  instructions.push({ type: "setmodtype", value: "dinput" });

  return Promise.resolve({ instructions });
}

export { testSupported, installScriptExtender };
