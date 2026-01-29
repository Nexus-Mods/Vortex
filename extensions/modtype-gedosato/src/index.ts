import { gameSupported, getPath } from "./gameSupport";

import Promise from "bluebird";
import * as path from "path";
import {} from "redux-thunk";
import { actions, fs, log, types, util } from "vortex-api";
import * as winapi from "winapi-bindings";

let gedosatoPath: string;

function getLocation(): Promise<string> {
  try {
    const instPath = winapi.RegGetValue(
      "HKEY_LOCAL_MACHINE",
      "Software\\Wow6432Node\\Durante\\GeDoSaTo",
      "InstallPath",
    );
    if (!instPath) {
      throw new Error("empty registry key");
    }
    return fs
      .statAsync(instPath.value as string)
      .then(() => instPath.value as string);
  } catch (err) {
    return Promise.reject(err);
  }
}

function isTexture(file: string) {
  return (
    file.endsWith(path.sep) ||
    [".dds", ".png"].includes(path.extname(file).toLowerCase())
  );
}

function allTextures(files: string[]): boolean {
  return files.find((file) => !isTexture(file)) === undefined;
}

let askGeDoSaTo: () => Promise<boolean>;

function testSupported(
  files: string[],
  gameId: string,
): Promise<types.ISupportedResult> {
  const isGeDoSaTo = gameSupported(gameId) && allTextures(files);
  const prom =
    !isGeDoSaTo || gedosatoPath !== undefined
      ? Promise.resolve(isGeDoSaTo)
      : askGeDoSaTo();

  return prom.then((choice) =>
    Promise.resolve({
      supported: isGeDoSaTo && choice,
      requiredFiles: [],
    }),
  );
}

function makeCopy(basePath: string, filePath: string): types.IInstruction {
  return {
    type: "copy",
    source: filePath,
    destination:
      basePath !== "." ? filePath.substring(basePath.length + 1) : filePath,
  };
}

function install(
  files: string[],
  destinationPath: string,
  gameId: string,
  progressDelegate: types.ProgressDelegate,
): Promise<types.IInstallResult> {
  const basePath = path.dirname(files.find(isTexture));
  const instructions: types.IInstruction[] = files
    .filter(
      (filePath) =>
        !filePath.endsWith(path.sep) &&
        (basePath === "." || filePath.startsWith(basePath + path.sep)),
    )
    .map((filePath) => makeCopy(basePath, filePath));

  return Promise.resolve({ instructions });
}

function isSupported(gameId: string): boolean {
  return gameSupported(gameId);
}

function init(context: types.IExtensionContext) {
  const getOutputPath = (game: types.IGame): string => {
    if (gedosatoPath !== undefined) {
      return path.join(gedosatoPath, "textures", getPath(game.id));
    } else {
      return undefined;
    }
  };

  const testGeDoSaTo = (instructions: types.IInstruction[]) =>
    Promise.resolve(
      allTextures(
        instructions
          .filter((instruction) => instruction.type === "copy")
          .map((instruction) => instruction.destination),
      ),
    );

  context.registerModType(
    "gedosato",
    50,
    isSupported,
    getOutputPath,
    testGeDoSaTo as any,
  );
  context.registerInstaller(
    "gedosato",
    50,
    testSupported as any,
    install as any,
  );

  askGeDoSaTo = (): Promise<boolean> => {
    return context.api.store
      .dispatch(
        actions.showDialog(
          "question",
          "GeDoSaTo not installed",
          {
            bbcode:
              "This looks like a mod that requires the tool GeDoSaTo<br />" +
              "To use it, you should cancel this installation now, get GeDoSaTo and then retry. " +
              "If you continue now, the mod may not be installed correctly and will not work " +
              "even after you install GeDoSaTo.<br />" +
              "Download from here: [url]https://community.pcgamingwiki.com/files/file/897-gedosato/[/url]<br />",
          },
          [{ label: "Cancel", default: true }, { label: "Ignore" }],
        ),
      )
      .then((result) =>
        result.action === "Ignore"
          ? Promise.resolve(true)
          : Promise.reject(new util.UserCanceled()),
      );
  };

  context.once(() => {
    return getLocation()
      .then((location) => {
        if (location === undefined) {
          log("info", "gedosato not installed or not found");
          return;
        }
        gedosatoPath = location;
      })
      .catch({ systemCode: 2 }, (err) => {
        log("info", "GeDoSaTo not installed");
      })
      .catch((err) => {
        log("warn", "failed to look for GeDoSaTo", { err: err.message });
      }) as any;
  });

  return true;
}

export default init;
