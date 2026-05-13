import * as path from "path";

import Bluebird from "bluebird";
import { actions, fs, selectors, types, util } from "vortex-api";
import IniParser, { WinapiFormat } from "vortex-parse-ini";

import { REDIRECTION_FILE, REDIRECTION_MOD } from "./constants";
import {
  archiveListKey,
  bsaVersion,
  defaultArchives,
  iniName,
  iniPath,
  isSupported,
} from "./util/gameSupport";

function genIniTweaksIni(api: types.IExtensionApi): Bluebird<string> {
  const gameId = selectors.activeGameId(api.store.getState());
  const parser = new IniParser(new WinapiFormat() as any);
  const archivesKey = archiveListKey(gameId);
  const nativePromise = parser.read(iniPath(gameId)).then((ini) => {
    let archives = defaultArchives(gameId);
    if (ini.data["Archive"] !== undefined && ini.data["Archive"][archivesKey] !== undefined) {
      archives = ini.data["Archive"][archivesKey];
    }
    return `[Archive]
bInvalidateOlderFiles=1
bUseArchives=1
${archivesKey}=${REDIRECTION_FILE}, ${archives}`;
  });

  return Bluebird.resolve(nativePromise);
}

function enableBSARedirection(api: types.IExtensionApi): Bluebird<void> {
  const store = api.store;
  const gameMode = selectors.activeGameId(store.getState());

  if (!isSupported(gameMode)) {
    return Bluebird.resolve(undefined);
  }

  const gamePath: string = util.getSafe(
    store.getState(),
    ["settings", "gameMode", "discovered", gameMode, "path"],
    undefined,
  );

  if (gamePath === undefined) {
    // TODO: happened in testing, but how does one get here with no path configured?
    return Bluebird.resolve(undefined);
  }

  const iniBaseName = path.basename(iniName(gameMode), ".ini");
  const redirectionIni = `BSA Redirection [${iniBaseName}].ini`;

  const mod: types.IMod = {
    id: REDIRECTION_MOD,
    state: "installed",
    attributes: {
      name: REDIRECTION_MOD,
    },
    installationPath: REDIRECTION_MOD,
    type: "",
  };

  const installPath = selectors.installPath(store.getState());
  const iniTweaksPath = path.join(installPath, REDIRECTION_MOD, "Ini Tweaks");

  const invalidationPath = path.join(installPath, REDIRECTION_MOD, REDIRECTION_FILE);
  const dummyFile = path.join(path.dirname(invalidationPath), "dummy", "dummy.dds");
  const createDummy = () =>
    fs
      .ensureDirWritableAsync(path.dirname(dummyFile))
      .then(() =>
        fs
          .writeFileAsync(dummyFile, "", { encoding: "utf8" })
          .catch((err) => (err.code !== "EEXIST" ? Bluebird.reject(err) : Bluebird.resolve())),
      );
  const cleanupDummy = () =>
    Bluebird.mapSeries([dummyFile, path.dirname(dummyFile)], (iter) =>
      fs.removeAsync(iter).catch((err) => Bluebird.resolve()),
    );

  return new Bluebird((resolve, reject) => {
    api.events.emit("create-mod", gameMode, mod, (error) => {
      if (error !== null) {
        return reject(error);
      }
      return resolve();
    });
  })
    .then(() => createDummy())
    .then(() => fs.ensureDirAsync(iniTweaksPath))
    .then(() =>
      fs.forcePerm(
        api.translate,
        () => {
          return api
            .openArchive(invalidationPath, {
              version: bsaVersion(gameMode).toString(),
              create: true,
            })
            .then((archive) =>
              archive
                .addFile(path.join("dummy", path.basename(dummyFile)), dummyFile)
                .then(() => archive.write()),
            );
        },
        invalidationPath,
      ),
    )
    .then(() => cleanupDummy())
    .then(() => genIniTweaksIni(api))
    .then((data) => fs.writeFileAsync(path.join(iniTweaksPath, redirectionIni), data))
    .then(() => {
      const profile = selectors.activeProfile(store.getState());
      store.dispatch(actions.setModEnabled(profile.id, REDIRECTION_MOD, true));
      store.dispatch(actions.setINITweakEnabled(gameMode, REDIRECTION_MOD, redirectionIni, true));
    })
    .catch((err) => {
      if (err["path"] === undefined) {
        err["path"] = invalidationPath;
      }
      return Bluebird.reject(err);
    });
}

export function toggleInvalidation(api: types.IExtensionApi, gameMode: string): Bluebird<void> {
  const mods = util.getSafe(api.store.getState(), ["persistent", "mods", gameMode], {});
  if (mods[REDIRECTION_MOD] !== undefined) {
    api.events.emit("remove-mod", gameMode, REDIRECTION_MOD);
    return Bluebird.resolve();
  } else {
    return enableBSARedirection(api)
      .catch(util.NotSupportedError, (err) => {
        api.showErrorNotification(
          "Failed to add invalidation mod",
          "The extension providing BSA support has been disabled or removed. " +
            "Without it, Vortex can't provide BSA redirection.",
          {
            allowReport: false,
          },
        );
        api.events.emit("remove-mod", gameMode, REDIRECTION_MOD);
      })
      .catch((err) => {
        api.showErrorNotification("Failed to add invalidation mod", err);
        api.events.emit("remove-mod", gameMode, REDIRECTION_MOD);
      });
  }
}
