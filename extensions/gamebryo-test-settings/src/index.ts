import {
  gameSupportXboxPass,
  iniPath,
  initGameSupport,
} from "./util/gameSupport";
import missingOblivionFont, {
  oblivionDefaultFonts,
} from "./util/missingOblivionFonts";
import missingSkyrimFonts from "./util/missingSkyrimFonts";

import Promise from "bluebird";
import * as path from "path";
import * as Redux from "redux";
import { actions, fs, log, selectors, types, util } from "vortex-api";
import IniParser, { IniFile, WinapiFormat } from "vortex-parse-ini";

const parser = new IniParser(new WinapiFormat());

function fixOblivionFonts(
  iniFile: IniFile<any>,
  missingFonts: string[],
  gameId: string,
): Promise<void> {
  return new Promise<void>((fixResolve, fixReject) => {
    try {
      Object.keys(iniFile.data.Fonts).forEach((key) => {
        if (
          missingFonts.find((item) => {
            return item === iniFile.data.Fonts[key];
          }) !== undefined
        ) {
          const keyL = key.toLowerCase();
          if (oblivionDefaultFonts[keyL] !== undefined) {
            iniFile.data.Fonts[key] = oblivionDefaultFonts[keyL];
          } else {
            delete iniFile.data.Fonts[key];
          }
        }
      });

      parser
        .write(iniPath(gameId), iniFile)
        .then(() => fixResolve())
        .catch((err) => fixReject(err));
    } catch (err) {
      fixReject(err);
    }
  });
}

function testOblivionFontsImpl(api: types.IExtensionApi) {
  const store: Redux.Store<types.IState> = api.store;
  const gameId = selectors.activeGameId(store.getState());

  if (gameId !== "oblivion") {
    return Promise.resolve(undefined);
  }

  let iniFile: IniFile<any>;

  return parser
    .read(iniPath(gameId))
    .then((iniFileIn: IniFile<any>) => {
      iniFile = iniFileIn;
      return missingOblivionFont(store, iniFile, gameId);
    })
    .then((missingFonts: string[]) => {
      if (missingFonts.length === 0) {
        return Promise.resolve(undefined);
      }

      const fontList = missingFonts.join("\n");

      return Promise.resolve({
        description: {
          short: "Fonts missing.",
          long:
            "Fonts referenced in oblivion.ini don't seem to be installed:\n" +
            fontList,
        },
        severity: "error" as types.ProblemSeverity,
        automaticFix: () => fixOblivionFonts(iniFile, missingFonts, gameId),
      });
    })
    .catch((err: Error) =>
      Promise.resolve({
        description: {
          short: "Failed to read Oblivion.ini.",
          long: err.toString(),
        },
        severity: "error" as types.ProblemSeverity,
      }),
    );
}

const defaultFonts: { [gameId: string]: Set<string> } = {};

function testSkyrimFontsImpl(context: types.IExtensionContext) {
  const store = context.api.store;
  const gameId = selectors.activeGameId(store.getState());

  const gameDiscovery: types.IDiscoveryResult = util.getSafe(
    store.getState(),
    ["settings", "gameMode", "discovered", gameId],
    undefined,
  );

  if (["skyrim", "enderal", "skyrimse", "skyrimvr"].indexOf(gameId) === -1) {
    return Promise.resolve(undefined);
  }

  if (gameDiscovery === undefined || gameDiscovery.path === undefined) {
    return Promise.resolve(undefined);
  }

  const game = util.getGame(gameId);

  const interfacePath = path.join(
    game.getModPaths(gameDiscovery.path)[""],
    "Skyrim - Interface.bsa",
  );

  const prom =
    defaultFonts[gameId] !== undefined
      ? Promise.resolve(undefined)
      : context.api
          .openArchive(interfacePath)
          .then((archive: util.Archive) =>
            archive.readDir("interface").tap(() => {
              // We don't need the archive open anymore. Usually we would just
              //  leave it to the GC to release the file handle whenever V8 decides
              //  to do it; but in this case the user might want to replace it entirely
              //  with a mod (stupid I know) https://github.com/Nexus-Mods/Vortex/issues/11672
              if (archive["mHandler"]?.closeArchive !== undefined) {
                archive["mHandler"].closeArchive();
              }
              archive = null;
            }),
          )
          .then((files: string[]) => {
            defaultFonts[gameId] = new Set<string>(
              files
                .filter((name) => path.extname(name) === ".swf")
                .map((name) => path.join("interface", name)),
            );
          })
          .catch((err: Error) => {
            if (err instanceof util.NotSupportedError) {
              log(
                "info",
                "Not checking font list because bsa archive support not available",
              );
              return Promise.reject(err);
            }
            return fs
              .statAsync(interfacePath)
              .then(() => {
                context.api.showErrorNotification(
                  "Failed to read default fonts",
                  err,
                  {
                    message: interfacePath,
                    allowReport: false,
                  },
                );
                return Promise.reject(
                  new util.ProcessCanceled("default fonts unknown"),
                );
              })
              .catch(() => {
                context.api.showErrorNotification(
                  '"Skyrim - Interface.bsa" appears to be missing',
                  err,
                  {
                    id: "skyrim_interface_bsa_missing",
                    allowReport: false,
                  },
                );
                return Promise.reject(
                  new util.ProcessCanceled("default fonts unknown"),
                );
              });
          });

  return prom
    .then(() =>
      missingSkyrimFonts(store.getState(), defaultFonts[gameId], gameId),
    )
    .then((missingFonts: string[]) => {
      if (missingFonts.length === 0) {
        return Promise.resolve(undefined);
      }

      const fontList = missingFonts.join("\n");

      return Promise.resolve({
        description: {
          short: "Fonts missing.",
          long:
            "Fonts referenced in fontconfig.txt don't seem to be installed:\n" +
            fontList,
        },
        severity: "error" as types.ProblemSeverity,
      });
    })
    .catch(util.NotSupportedError, () => Promise.resolve(undefined))
    .catch(util.ProcessCanceled, () => Promise.resolve(undefined))
    .catch((err: Error) => {
      return Promise.resolve({
        description: {
          short: "Failed to read fontconfig.txt.",
          long: err.toString(),
        },
        severity: "error" as types.ProblemSeverity,
      });
    });
}

function init(context: types.IExtensionContext): boolean {
  initGameSupport(context.api);
  const testOblivionFonts = (): Promise<types.ITestResult> =>
    testOblivionFontsImpl(context.api);

  const testSkyrimFonts = (): Promise<types.ITestResult> =>
    testSkyrimFontsImpl(context);

  context.registerTest(
    "oblivion-fonts",
    "gamemode-activated",
    testOblivionFonts as any,
  );
  context.registerTest(
    "skyrim-fonts",
    "gamemode-activated",
    testSkyrimFonts as any,
  );

  return true;
}

export default init;
