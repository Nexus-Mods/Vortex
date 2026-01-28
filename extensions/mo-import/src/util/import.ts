import { IModEntry } from "../types/moEntries";
import { transferArchive, transferUnpackedMod } from "../util/modFileMigration";

import { IMOConfig } from "./parseMOIni";
import toVortexMod from "./toVortexMod";
import TraceImport from "./TraceImport";

import Promise from "bluebird";
import * as I18next from "i18next";
import { genHash } from "modmeta-db";
import * as path from "path";
import * as Redux from "redux";
import { generate as shortid } from "shortid";
import { actions, fs, selectors, types } from "vortex-api";

function getInner(ele: Element): string {
  if (ele !== undefined && ele !== null) {
    const node = ele.childNodes[0];
    if (node !== undefined) {
      return node.nodeValue;
    }
  }
  return undefined;
}

function importMods(
  t: I18next.TranslationFunction,
  store: Redux.Store<types.IState>,
  trace: TraceImport,
  moConfig: IMOConfig,
  mods: IModEntry[],
  importArchives: boolean,
  progress: (mod: string, idx: number) => void,
): Promise<string[]> {
  const gameId = selectors.activeGameId(store.getState());

  const errors: string[] = [];

  return trace
    .writeFile("parsedMods.json", JSON.stringify(mods))
    .then(() => {
      trace.log("info", "transfer unpacked mods files");
      const installPath = selectors.installPath(store.getState());
      const downloadPath = selectors.downloadPath(store.getState());
      return Promise.mapSeries(mods, (mod, idx, len) => {
        trace.log("info", "transferring", mod);
        progress(mod.modName, idx / len);
        const archivePath =
          mod.archiveName === undefined || path.isAbsolute(mod.archiveName)
            ? mod.archiveName
            : path.join(moConfig.downloadPath, mod.archiveName);
        return transferUnpackedMod(
          mod,
          path.join(moConfig.modPath, mod.modName),
          installPath,
          true,
        )
          .then(() =>
            mod.archiveName === undefined || mod.archiveName === ""
              ? Promise.resolve("")
              : genHash(archivePath)
                  .then((hash) => hash.md5sum)
                  .catch((err) => ""),
          )
          .then((md5Hash) => {
            const archiveId = shortid();
            store.dispatch(
              actions.addMod(gameId, toVortexMod(mod, md5Hash, archiveId)),
            );

            if (importArchives && !!mod.archiveName) {
              trace.log("info", "transferring archive", archivePath);
              progress(mod.modName + " (" + t("Archive") + ")", idx / len);
              return fs
                .statAsync(archivePath)
                .then((stats) => {
                  store.dispatch(
                    actions.addLocalDownload(
                      archiveId,
                      gameId,
                      path.basename(archivePath),
                      stats.size,
                    ),
                  );
                  return transferArchive(archivePath, downloadPath, true);
                })
                .tap(() => {
                  // Attempt to set metadata information for the newly added archive.
                  if (mod.nexusId !== "0") {
                    store.dispatch(
                      actions.setDownloadModInfo(archiveId, "source", "nexus"),
                    );
                    store.dispatch(
                      actions.setDownloadModInfo(
                        archiveId,
                        "nexus.ids.modId",
                        parseInt(mod.nexusId, 10),
                      ),
                    );
                    store.dispatch(
                      actions.setDownloadModInfo(
                        archiveId,
                        "nexus.ids.gameId",
                        gameId,
                      ),
                    );

                    if (!!mod.modVersion) {
                      store.dispatch(
                        actions.setDownloadModInfo(
                          archiveId,
                          "version",
                          mod.modVersion,
                        ),
                      );
                    }
                    store.dispatch(
                      actions.setDownloadModInfo(archiveId, "game", gameId),
                    );
                    store.dispatch(
                      actions.setDownloadModInfo(
                        archiveId,
                        "name",
                        mod.modName,
                      ),
                    );
                  }
                })
                .catch((err) => {
                  if (err.code === "ENOENT") {
                    trace.log("info", "archive doesn't exist");
                    return Promise.resolve();
                  } else {
                    return Promise.reject(err);
                  }
                });
            } else {
              return Promise.resolve();
            }
          })
          .catch((err) => {
            trace.log("error", "Failed to import", err);
            errors.push(mod.modName);
          });
      }).then(() => {
        trace.log("info", "Finished transferring unpacked mod files");
      });
    })
    .then(() => {
      trace.finish();
      return errors;
    });
}

export default importMods;
