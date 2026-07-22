import { rename, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { getErrorMessageOrDefault, unknownToError } from "@vortex/shared";
import PromiseBB from "bluebird";
import * as _ from "lodash";
import SevenZip from "node-7z";
import rimraf from "rimraf";

import { forgetExtension, removeExtension } from "../../actions";
import ExtensionManager from "../../ExtensionManager";
import { log } from "../../logging";
import type { ExtensionType, IExtension } from "../../types/extensions";
import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import { DataInvalid } from "../../util/CustomErrors";
import { withTrackedActivity } from "../../util/errorHandling";
import * as fs from "../../util/fs";
import getVortexPath from "../../util/getVortexPath";
import { INVALID_FILENAME_RE } from "../../util/util";
import { webpackRequireHack } from "../../util/webpack-hacks";
import {
  emitExtensionInstalled,
  type ExtensionInstallSource,
} from "../analytics/mixpanel/extensionInstallAnalytics";
import { countryExists, languageExists } from "../settings_interface/languagemap";
import { readExtensionInfo } from "./util";

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

function installExtensionDependencies(api: IExtensionApi, extPath: string): PromiseBB<void> {
  const handler = new ContextProxyHandler();
  const context = new Proxy({}, handler);

  try {
    const extension = webpackRequireHack(path.join(extPath, "index.js"));
    const initFunc = ExtensionManager.getExtensionInitFunc(extension);
    if (initFunc === undefined) {
      log("warn", "extension has no init function, skipping dependency scan", {
        extPath,
      });
      return PromiseBB.resolve();
    }
    initFunc(context);

    const state: IState = api.store.getState();

    const { installed, available } = state.session.extensions;

    return PromiseBB.map(handler.dependencies, (depId) => {
      if (installed[depId] !== undefined) {
        return;
      }

      const ext = available.find(
        (iter) => !iter.type && (iter.name === depId || iter.id === depId),
      );

      // Direct key lookup can miss when the dependent calls
      // requireExtension(<Nexus display name>) but the installed map is
      // keyed by info.json `id` (or folder basename). UEMI is the canonical
      // case: published as "Unreal Engine Mod Installer", but its info.json
      // name is "Unreal Engine Game Library", so neither key nor name match.
      // Cross-reference via the Nexus available manifest and compare modId,
      // which is populated on every Nexus install.
      if (ext !== undefined) {
        const alreadyInstalled = Object.values(installed).some(
          (entry) =>
            (ext.modId !== undefined && entry.modId === ext.modId) || entry.name === ext.name,
        );
        if (alreadyInstalled) {
          return;
        }
        // TODO: remove evil
        return PromiseBB.resolve(
          api.emitAndAwait<"install-extension">("install-extension", ext).then(() => undefined),
        );
      } else {
        return PromiseBB.resolve();
      }
    }).then(() => null);
  } catch (unknownErr) {
    const err = unknownToError(unknownErr);
    // TODO: can't check for dependencies if the extension is already loaded
    //   and registers actions
    if (err.name === "TypeError" && err.message.startsWith("Duplicate action type")) {
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

/**
 * Clears the post-install `remove: true` flag for entries whose folder the new
 * install just renamed into place. Entries pointing at distinct, still-on-disk
 * folders keep their flag so the next startup's cleanup deletes them (#23295).
 */
export function clearStaleRemovalFlags(
  api: IExtensionApi,
  removedKeys: string[],
  destPath: string,
): void {
  const state: IState = api.store.getState();
  const { installed } = state.session.extensions;
  // Compare paths, not key strings: info.json `id` can decouple the state key
  // from the folder basename, and the archive-name fallback differs again.
  const normalizedDest = path.normalize(destPath).toLowerCase();
  removedKeys.forEach((key) => {
    const prevPath = installed[key]?.path;
    if (prevPath !== undefined && path.normalize(prevPath).toLowerCase() === normalizedDest) {
      api.store.dispatch(forgetExtension(key));
    }
  });
}

function removeOldVersion(api: IExtensionApi, info: IExtension): PromiseBB<string[]> {
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
  return PromiseBB.resolve(previousVersions);
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
      fs.statAsync(path.join(extPath, fileName)).then((stats) => stats.isDirectory()),
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
      fs.statAsync(path.join(extPath, fileName)).then((stats) => stats.isDirectory()),
    )
    .then((dirNames) => {
      if (dirNames.length !== 1) {
        return PromiseBB.reject(new DataInvalid("Expected exactly one language subdirectory"));
      }
      // the check in isLocaleCode is extremely unreliable because it will fall back to
      // iso on everything. Was it always like that or was that changed in a recent
      // node release?
      const [language, country] = dirNames[0].split("-");
      if (!languageExists(language) || (country !== undefined && !countryExists(country))) {
        return PromiseBB.reject(new DataInvalid("Directory isn't a language code"));
      }
      return fs.readdirAsync(path.join(extPath, dirNames[0])).then((files) => {
        if (files.find((fileName) => path.extname(fileName) === ".json") === undefined) {
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
        new DataInvalid("Extension needs to include index.js and info.json on top-level"),
      );
    });
}

function validateInstall(extPath: string, info?: IExtension): PromiseBB<ExtensionType> {
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
              "Doesn't seem to contain a correctly packaged extension, " + "theme or translation",
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
    return validateTheme(extPath).then(() => PromiseBB.resolve("theme" as ExtensionType));
  } else if (info.type === "translation") {
    return validateTranslation(extPath).then(() =>
      PromiseBB.resolve("translation" as ExtensionType),
    );
  } else {
    return validateExtension(extPath).then(() => PromiseBB.resolve(undefined));
  }
}

interface InstallAnalytics {
  source: ExtensionInstallSource;
  gameDomain?: string;
  gameName?: string;
}

// Concurrent install attempts of the same archive (e.g. the update check firing
// more than once) would extract into the same ".installing" directory
// simultaneously and fail with "Cannot delete output file ... being used by
// another process" (#23454). Dedupe them onto a single in-flight promise.
const activeInstalls: Map<string, Promise<void>> = new Map();

function installExtension(
  api: IExtensionApi,
  archivePath: string,
  info?: IExtension,
  analytics: InstallAnalytics = { source: "manual" },
): Promise<void> {
  const key = path.basename(archivePath).toLowerCase();
  const active = activeInstalls.get(key);

  if (active !== undefined) {
    return active;
  }

  const result = installExtensionImpl(api, archivePath, info, analytics).finally(() => {
    activeInstalls.delete(key);
  });

  activeInstalls.set(key, result);
  return result;
}

async function installExtensionImpl(
  api: IExtensionApi,
  archivePath: string,
  info: IExtension | undefined,
  analytics: InstallAnalytics,
): Promise<void> {
  const extensionsPath = path.join(getVortexPath("userData"), "plugins");
  let destPath: string;
  const tempPath = path.join(extensionsPath, path.basename(archivePath)) + ".installing";

  const extractor = new SevenZip();

  await withTrackedActivity(
    "vortex.extension-manager",
    "extension.install",
    {
      "extension.archive": path.basename(archivePath),
      "extension.name": info?.name,
      "extension.type": info?.type,
    },
    async () => {
      try {
        await rm(tempPath, { recursive: true, force: true, maxRetries: 3 });
      } catch (err) {
        throw new DataInvalid(
          "Failed to remove files left over from a previous install attempt: " +
            `${getErrorMessageOrDefault(err)}. They may be locked by another process ` +
            "(e.g. an antivirus scan); please try again or restart your computer.",
        );
      }

      const result = await Promise.resolve(
        extractor.extractFull(archivePath, tempPath, { ssc: false }),
      );

      // node-7z can resolve (not reject) with a non-zero exit code or
      // a populated errors array on partial/failed extraction. Without
      // this check, validateInstall runs against an empty or partial
      // tempPath and we surface a misleading "needs index.js and
      // info.json on top-level" error instead of the real cause
      // (locked file, AV quarantine, corrupt download, etc.).
      const code = result?.code ?? 0;
      const errors = result?.errors ?? [];
      if (code !== 0 || errors.length > 0) {
        log(code !== 0 ? "error" : "warn", "extension extraction reported issues", {
          archivePath,
          tempPath,
          code,
          errors: errors.join("; "),
        });
      }

      if (code !== 0) {
        const detail = errors.length > 0 ? errors.join("; ") : `exit code ${code}`;
        throw new DataInvalid(`Failed to extract extension archive: ${detail}`);
      }

      const manifestInfo = await Promise.resolve(readExtensionInfo(tempPath, false, info));

      // merge the caller-provided info with the stuff parsed from the info.json file because there
      // is data we may only know at runtime (e.g. the modId)
      const fullInfo = { ...(manifestInfo.info || {}), ...info };
      if (fullInfo.type === undefined) {
        // TODO: native Promise
        fullInfo.type = await Promise.resolve(validateInstall(tempPath, info));
      }

      // update the manifest on disc, in case we had new info from the caller
      await writeFile(path.join(tempPath, "info.json"), JSON.stringify(fullInfo, undefined, 2));

      const dirName = sanitize(manifestInfo.id);
      destPath = path.join(extensionsPath, dirName);

      // Keys whose previous-version state entries were marked for removal during
      // this install. Cleared after the rename succeeds so the next launch's
      // state-flag-driven removal path in ExtensionManager doesn't wipe the
      // just-installed folder (#19527).
      // TODO: native Promise
      const removedKeys = await Promise.resolve(removeOldVersion(api, fullInfo));

      // we don't actually expect the output directory to exist
      await rm(destPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      await rename(tempPath, destPath);

      clearStaleRemovalFlags(api, removedKeys, destPath);
      emitExtensionInstalled(
        api,
        { ...fullInfo, type: fullInfo.type, id: manifestInfo.id },
        {
          source: analytics.source,
          isUpdate: removedKeys.length > 0,
          gameDomain: analytics.gameDomain,
          gameName: analytics.gameName,
        },
      );

      if (fullInfo.type === "theme" || fullInfo.type === "translation") return;

      // don't install dependencies for extensions that are already loaded because
      // doing so could cause an exception
      if (api.getLoadedExtensions().find((ext) => ext.name === manifestInfo.id) === undefined) {
        // TODO: native Promise
        await Promise.resolve(installExtensionDependencies(api, destPath));
      }
    },
  );
}

export default installExtension;
