import { transferArchive } from "./modFileImport";

import { IModEntry } from "../types/nmmEntries";
import TraceImport from "./TraceImport";
import { addMetaData } from "./vortexImports";

import Promise from "bluebird";
import * as path from "path";
import { generate as shortid } from "shortid";
import { actions, fs, selectors, types, util } from "vortex-api";

function getInner(ele: Element): string {
  if (ele !== undefined && ele !== null) {
    const node = ele.childNodes[0];
    if (node !== undefined) {
      return node.nodeValue;
    }
  }
  return undefined;
}

function enhance(
  sourcePath: string,
  input: IModEntry,
  nmmCategories: { [id: string]: string },
  vortexCategory: (name: string) => string,
): Promise<IModEntry> {
  // this id is currently identically to what we store as the vortexId but I don't want
  // to rely on that always being the case
  const id = path.basename(input.modFilename, path.extname(input.modFilename));
  const cacheBasePath = path.resolve(sourcePath, "cache", id);
  return fs
    .readFileAsync(path.join(cacheBasePath, "cacheInfo.txt"))
    .then((data) => {
      const fields = data.toString().split("@@");
      return fs.readFileAsync(
        path.join(
          cacheBasePath,
          fields[1] === "-" ? "" : fields[1],
          "fomod",
          "info.xml",
        ),
      );
    })
    .then((infoXmlData) => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(infoXmlData.toString(), "text/xml");

      const customName = getInner(xmlDoc.querySelector("fomod Name"));

      let categoryId =
        getInner(xmlDoc.querySelector("fomod CustomCategoryId")) ||
        getInner(xmlDoc.querySelector("fomod CategoryId"));
      const category =
        categoryId !== undefined ? nmmCategories[categoryId] : undefined;

      categoryId =
        category !== undefined ? vortexCategory(category) : undefined;

      return {
        ...input,
        archiveId: shortid(),
        categoryId,
        customName,
      };
    })
    .catch((err) => ({
      ...input,
      archiveId: shortid(),
    }));
}

function importArchives(
  api: types.IExtensionApi,
  gameId: string,
  trace: TraceImport,
  modsPath: string,
  mods: IModEntry[],
  categories: { [id: string]: string },
  progress: (mod: string, idx: number) => void,
): Promise<string[]> {
  const store = api.store;
  const state: types.IState = store.getState();
  const vortexCategories = state.persistent.categories[gameId];

  const makeVortexCategory = (name: string): string => {
    const existing = Object.keys(vortexCategories).find(
      (key) => vortexCategories[key].name === name,
    );
    if (existing !== undefined) {
      return existing;
    }

    if (vortexCategories["nmm_0"] === undefined) {
      trace.log("info", "Adding root for imported NMM categories");
      store.dispatch(
        actions.setCategory(gameId, "nmm_0", {
          name: "Imported from NMM",
          order: 0,
          parentCategory: undefined,
        }),
      );
    }

    let id = 1;
    while (vortexCategories[`nmm_${id}`] !== undefined) {
      ++id;
    }

    trace.log("info", "NMM category couldn't be matched, importing", name);
    store.dispatch(
      actions.setCategory(gameId, `nmm_${id}`, {
        name,
        order: 0,
        parentCategory: "nmm_0",
      }),
    );
    return `nmm_${id}`;
  };

  const errors: string[] = [];

  const transferArchiveFile = (
    source: string,
    dest: string,
    mod: IModEntry,
    size: number,
  ): Promise<void> => {
    return transferArchive(source, dest)
      .then(() => {
        const downloads = util.getSafe(
          state,
          ["persistent", "downloads", "files"],
          undefined,
        );
        if (downloads === undefined) {
          // The user hasn't downloaded anything yet.
          return Promise.resolve();
        }

        // Ensure we don't have any duplicate archive ids pointing
        //  to the same localPath - if we do, remove them.
        const archiveIds = Object.keys(downloads);
        const filtered = archiveIds.filter(
          (id) => downloads[id].localPath === mod.modFilename,
        );
        filtered.forEach((id) => {
          mod.archiveId = id;
          store.dispatch(actions.removeDownload(id));
        });
        return Promise.resolve();
      })
      .then(() => {
        store.dispatch(
          actions.addLocalDownload(
            mod.archiveId,
            gameId,
            mod.modFilename,
            size,
          ),
        );
        return Promise.resolve();
      });
  };

  return trace
    .writeFile("parsedMods.json", JSON.stringify(mods))
    .then(() => {
      const importedArchives: IModEntry[] = [];
      trace.log("info", "transfer archive files");
      const downloadPath = selectors.downloadPath(state);
      return Promise.map(mods, (mod) =>
        enhance(modsPath, mod, categories, makeVortexCategory),
      ).then((modsEx) =>
        Promise.mapSeries(modsEx, (mod, idx) => {
          trace.log(
            "info",
            "transferring",
            JSON.stringify(mod.modFilename, undefined, 2),
          );
          progress(mod.modName, idx);
          const archivePath = path.join(mod.archivePath, mod.modFilename);
          return fs
            .statAsync(archivePath)
            .then((stats) =>
              transferArchiveFile(archivePath, downloadPath, mod, stats.size),
            )
            .tap(() => importedArchives.push(mod))
            .catch((err) => {
              trace.log(
                "error",
                "Failed to import mod archive",
                archivePath + " - " + err.message,
              );
              errors.push(mod.modFilename);
            });
        }).then(() => {
          trace.log("info", "Finished transferring mod archives");
          if (importedArchives.length > 0) {
            addMetaData(gameId, importedArchives, api);
            api.events.emit(
              "did-import-downloads",
              importedArchives.map((arch) => arch.archiveId),
            );
          }
        }),
      );
    })
    .then(() => {
      trace.finish();
      return errors;
    });
}

export default importArchives;
