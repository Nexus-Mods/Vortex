import { removeExtension } from "../../actions";
import { unknownToError } from "@vortex/shared";
import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import { DataInvalid } from "../../util/CustomErrors";
import * as fs from "../../util/fs";
import getVortexPath from "../../util/getVortexPath";
import lazyRequire from "../../util/lazyRequire";
import { log } from "../../util/log";
import { INVALID_FILENAME_RE } from "../../util/util";

import {
  countryExists,
  languageExists,
} from "../settings_interface/languagemap";

import type { ExtensionType, IExtension } from "../../types/extensions";
import { readExtensionInfo } from "./util";

import PromiseBB from "bluebird";
import * as _ from "lodash";
import type ZipT from "node-7z";
import * as path from "path";
import rimraf from "rimraf";
import type * as vortexRunT from "vortex-run";

const vortexRun: typeof vortexRunT = lazyRequire(() => require("vortex-run"));

const rimrafAsync: (removePath: string, options: any) => PromiseBB<void> =
  PromiseBB.promisify(rimraf);

class ContextProxyHandler implements ProxyHandler<any> {
  private mDependencies: string[] = [];

  public get(target, key: PropertyKey): any {
    if (key === "requireExtension") {
      return (dependencyId: string) => {
        this.mDependencies.push(dependencyId);
      };
    } else if (key === "optional") {
      return new Proxy(
        {},
        {
          get() {
            return () => undefined;
          },
        },
      );
    } else if (key === "api") {
      return {
        translate: (input) => input,
      };
    } else {
      return () => undefined;
    }
  }

  public get dependencies(): string[] {
    return this.mDependencies;
  }
}

function installExtensionDependencies(
  api: IExtensionApi,
  extPath: string,
): PromiseBB<void> {
  const handler = new ContextProxyHandler();
  const context = new Proxy({}, handler);

  try {
    const extension = vortexRun.dynreq(path.join(extPath, "index.js"));
    extension.default(context);

    const state: IState = api.store.getState();

    return PromiseBB.map(handler.dependencies, (depId) => {
      if (state.session.extensions.installed[depId] !== undefined) {
        return;
      }
      const ext = state.session.extensions.available.find(
        (iter) => !iter.type && (iter.name === depId || iter.id === depId),
      );

      if (ext !== undefined) {
        return api.emitAndAwait("install-extension", ext);
      } else {
        return PromiseBB.resolve();
      }
    }).then(() => null);
  } catch (unknownErr) {
    const err = unknownToError(unknownErr);
    // TODO: can't check for dependencies if the extension is already loaded
    //   and registers actions
    if (
      err.name === "TypeError" &&
      err.message.startsWith("Duplicate action type")
    ) {
      return PromiseBB.resolve();
    }
    return PromiseBB.reject(err);
  }
}

function sanitize(input: string): string {
  const temp = input.replace(INVALID_FILENAME_RE, "_");
  const ext = path.extname(temp);
  if ([".7z", ".zip", ".rar"].includes(ext.toLowerCase())) {
    return path.basename(temp, path.extname(temp));
  } else {
    return path.basename(temp);
  }
}

function removeOldVersion(
  api: IExtensionApi,
  info: IExtension,
): PromiseBB<void> {
  const state: IState = api.store.getState();
  const { installed } = state.session.extensions;

  // should never be more than one but let's handle multiple to be safe
  const previousVersions = Object.keys(installed).filter(
    (key) =>
      !installed[key].bundled &&
      ((info.id !== undefined && installed[key].id === info.id) ||
        (info.modId !== undefined && installed[key].modId === info.modId) ||
        installed[key].name === info.name),
  );
  if (previousVersions.length > 0) {
    log("info", "removing previous versions of the extension", {
      previousVersions,
      newPath: info.path,
      paths: previousVersions.map((iter) => installed[iter].path),
    });
  }

  previousVersions.forEach((key) => api.store.dispatch(removeExtension(key)));
  return PromiseBB.resolve();
}

/**
 * validate a theme extension. A theme extension can contain multiple themes, one directory
 * per theme, each is expected to contain at least one of
 * "variables.scss", "style.scss" or "fonts.scss"
 */
function validateTheme(extPath: string): PromiseBB<void> {
  return fs
    .readdirAsync(extPath)
    .filter((fileName: string) =>
      fs
        .statAsync(path.join(extPath, fileName))
        .then((stats) => stats.isDirectory()),
    )
    .then((dirNames) => {
      if (dirNames.length === 0) {
        return PromiseBB.reject(
          new DataInvalid("Expected a subdirectory containing the stylesheets"),
        );
      }
      return PromiseBB.map(dirNames, (dirName) =>
        fs.readdirAsync(path.join(extPath, dirName)).then((files) => {
          if (
            !files.includes("variables.scss") &&
            !files.includes("style.scss") &&
            !files.includes("fonts.scss")
          ) {
            return PromiseBB.reject(new DataInvalid("Theme not found"));
          } else {
            return PromiseBB.resolve();
          }
        }),
      ).then(() => null);
    });
}

function isLocaleCode(input: string): boolean {
  try {
    new Date().toLocaleString(input);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * validate a translation extension. Can only contain one iso-code named directory (other
 * directories are ignored) which needs to contain at least one json file
 */
function validateTranslation(extPath: string): PromiseBB<void> {
  return fs
    .readdirAsync(extPath)
    .filter((fileName: string) => isLocaleCode(fileName))
    .filter((fileName: string) =>
      fs
        .statAsync(path.join(extPath, fileName))
        .then((stats) => stats.isDirectory()),
    )
    .then((dirNames) => {
      if (dirNames.length !== 1) {
        return PromiseBB.reject(
          new DataInvalid("Expected exactly one language subdirectory"),
        );
      }
      // the check in isLocaleCode is extremely unreliable because it will fall back to
      // iso on everything. Was it always like that or was that changed in a recent
      // node release?
      const [language, country] = dirNames[0].split("-");
      if (
        !languageExists(language) ||
        (country !== undefined && !countryExists(country))
      ) {
        return PromiseBB.reject(
          new DataInvalid("Directory isn't a language code"),
        );
      }
      return fs.readdirAsync(path.join(extPath, dirNames[0])).then((files) => {
        if (
          files.find((fileName) => path.extname(fileName) === ".json") ===
          undefined
        ) {
          return PromiseBB.reject(new DataInvalid("No translation files"));
        }

        return PromiseBB.resolve();
      });
    });
}

/**
 * validate an extension. It has to contain an index.js and info.json on the top-level
 */
function validateExtension(extPath: string): PromiseBB<void> {
  return PromiseBB.all([
    fs.statAsync(path.join(extPath, "index.js")),
    fs.statAsync(path.join(extPath, "info.json")),
  ])
    .then(() => null)
    .catch({ code: "ENOENT" }, () => {
      return PromiseBB.reject(
        new DataInvalid(
          "Extension needs to include index.js and info.json on top-level",
        ),
      );
    });
}

function validateInstall(
  extPath: string,
  info?: IExtension,
): PromiseBB<ExtensionType> {
  if (info === undefined) {
    let validAsTheme: boolean = true;
    let validAsTranslation: boolean = true;
    let validAsExtension: boolean = true;

    const guessedType: ExtensionType = undefined;
    // if we don't know the type we can only check if _any_ extension type applies
    return validateTheme(extPath)
      .catch(DataInvalid, () => (validAsTheme = false))
      .then(() => validateTranslation(extPath))
      .catch(DataInvalid, () => (validAsTranslation = false))
      .then(() => validateExtension(extPath))
      .catch(DataInvalid, () => (validAsExtension = false))
      .then(() => {
        if (!validAsExtension && !validAsTheme && !validAsTranslation) {
          return PromiseBB.reject(
            new DataInvalid(
              "Doesn't seem to contain a correctly packaged extension, " +
                "theme or translation",
            ),
          );
        }

        // at least one type was valid, let's guess what it really is
        if (validAsExtension) {
          return PromiseBB.resolve(undefined);
        } else if (validAsTranslation) {
          // it's unlikely we would mistake a theme for a translation since it would require
          // it to contain a directory named like a iso language code including json files.
          return PromiseBB.resolve("translation" as ExtensionType);
        } else {
          return PromiseBB.resolve("theme" as ExtensionType);
        }
      });
  } else if (info.type === "theme") {
    return validateTheme(extPath).then(() =>
      PromiseBB.resolve("theme" as ExtensionType),
    );
  } else if (info.type === "translation") {
    return validateTranslation(extPath).then(() =>
      PromiseBB.resolve("translation" as ExtensionType),
    );
  } else {
    return validateExtension(extPath).then(() => PromiseBB.resolve(undefined));
  }
}

function installExtension(
  api: IExtensionApi,
  archivePath: string,
  info?: IExtension,
): PromiseBB<void> {
  const extensionsPath = path.join(getVortexPath("userData"), "plugins");
  let destPath: string;
  const tempPath =
    path.join(extensionsPath, path.basename(archivePath)) + ".installing";

  const Zip: typeof ZipT = require("node-7z");
  const extractor = new Zip();

  let fullInfo: any = info || {};

  let type: ExtensionType;

  let extName: string;
  return (
    extractor
      .extractFull(
        archivePath,
        tempPath,
        { ssc: false },
        () => undefined,
        () => undefined,
      )
      .then(() =>
        validateInstall(tempPath, info).then(
          (guessedType) => (type = guessedType),
        ),
      )
      .then(() => readExtensionInfo(tempPath, false, info))
      // merge the caller-provided info with the stuff parsed from the info.json file because there
      // is data we may only know at runtime (e.g. the modId)
      .then((manifestInfo) => {
        fullInfo = { ...(manifestInfo.info || {}), ...fullInfo };
        const res: { id: string; info: Partial<IExtension> } = {
          id: manifestInfo.id,
          info: fullInfo,
        };

        if (res.info.type === undefined) {
          res.info.type = type;
        }

        return res;
      })
      .catch({ code: "ENOENT" }, () =>
        info !== undefined
          ? PromiseBB.resolve({
              id: path.basename(archivePath, path.extname(archivePath)),
              info,
            })
          : PromiseBB.reject(new Error("not an extension, info.json missing")),
      )
      .then((manifestInfo) =>
        // update the manifest on disc, in case we had new info from the caller
        fs
          .writeFileAsync(
            path.join(tempPath, "info.json"),
            JSON.stringify(manifestInfo.info, undefined, 2),
          )
          .then(() => manifestInfo),
      )
      .then((manifestInfo: { id: string; info: IExtension }) => {
        extName = manifestInfo.id;

        const dirName = sanitize(manifestInfo.id);
        destPath = path.join(extensionsPath, dirName);
        if (manifestInfo.info.type !== undefined) {
          type = manifestInfo.info.type;
        }
        return removeOldVersion(api, manifestInfo.info);
      })
      // we don't actually expect the output directory to exist
      .then(() => fs.removeAsync(destPath))
      .then(() => fs.renameAsync(tempPath, destPath))
      .then(() => {
        if (type === "translation") {
          return fs
            .readdirAsync(destPath)
            .map((entry: string) =>
              fs
                .statAsync(path.join(destPath, entry))
                .then((stat) => ({ name: entry, stat })),
            )
            .then(() => null);
        } else if (type === "theme") {
          return PromiseBB.resolve();
        } else {
          // don't install dependencies for extensions that are already loaded because
          // doing so could cause an exception
          if (
            api.getLoadedExtensions().find((ext) => ext.name === extName) ===
            undefined
          ) {
            return installExtensionDependencies(api, destPath);
          } else {
            return PromiseBB.resolve();
          }
        }
      })
      .catch(DataInvalid, (err) =>
        rimrafAsync(tempPath, { glob: false }).then(() =>
          api.showErrorNotification("Invalid Extension", err, {
            allowReport: false,
            message: archivePath,
          }),
        ),
      )
      .catch((err) =>
        rimrafAsync(tempPath, { glob: false }).then(() =>
          PromiseBB.reject(err),
        ),
      )
  );
}

export default installExtension;
