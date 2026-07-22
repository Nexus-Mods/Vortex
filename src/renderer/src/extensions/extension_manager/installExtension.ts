import { stat, rename, rm, writeFile, readdir } from "node:fs/promises";
import * as path from "node:path";

import { getErrorMessageOrDefault, unknownToError } from "@vortex/shared";
import * as _ from "lodash";
import SevenZip from "node-7z";

import { forgetExtension, removeExtension } from "../../actions";
import ExtensionManager from "../../ExtensionManager";
import { log } from "../../logging";
import type { ExtensionType, IExtension } from "../../types/extensions";
import type { IExtensionApi, IExtensionContext } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import { DataInvalid } from "../../util/CustomErrors";
import { withTrackedActivity } from "../../util/errorHandling";
import getVortexPath from "../../util/getVortexPath";
import { INVALID_FILENAME_RE } from "../../util/util";
import { webpackRequireHack } from "../../util/webpack-hacks";
import {
  emitExtensionInstalled,
  type ExtensionInstallSource,
} from "../analytics/mixpanel/extensionInstallAnalytics";
import { countryExists, languageExists } from "../settings_interface/languagemap";
import { readExtensionInfo } from "./util";

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

async function installExtensionDependencies(api: IExtensionApi, extPath: string): Promise<void> {
  const handler = new ContextProxyHandler();
  const context = new Proxy<IExtensionContext>({} as IExtensionContext, handler);

  try {
    const extension: unknown = webpackRequireHack(path.join(extPath, "index.js"));
    const initFunc = ExtensionManager.getExtensionInitFunc(extension);
    if (initFunc === undefined) {
      log("warn", "extension has no init function, skipping dependency scan", {
        extPath,
      });

      return;
    }

    initFunc(context);

    const state = api.getState();
    const { installed, available } = state.session.extensions;

    const promises = handler.dependencies.map(async (dependencyId) => {
      if (installed[dependencyId]) return;

      const toInstall = available.find(
        (iter) => !iter.type && (iter.name === dependencyId || iter.id === dependencyId),
      );

      if (!toInstall) return;
      const alreadyInstalled = Object.values(installed).some(
        (entry) =>
          (toInstall.modId !== undefined && entry.modId === toInstall.modId) ||
          entry.name === toInstall.name,
      );
      if (alreadyInstalled) return;

      await api.emitAndAwait<"install-extension">("install-extension", toInstall);
    });

    await Promise.all(promises);
  } catch (unknownErr) {
    const err = unknownToError(unknownErr);
    // TODO: can't check for dependencies if the extension is already loaded
    //   and registers actions
    if (err.name === "TypeError" && err.message.startsWith("Duplicate action type")) return;
    throw err;
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

function removeOldVersion(api: IExtensionApi, info: IExtension): string[] {
  const state = api.getState();
  const { installed } = state.session.extensions;

  // should never be more than one but let's handle multiple to be safe
  const previousVersions = Object.entries(installed).filter(([_, ext]) => {
    if (ext.bundled) return false;
    if (info.id !== undefined && ext.id === info.id) return true;
    if (info.modId !== undefined && ext.modId === info.modId) return true;
    return info.name === ext.name;
  });

  if (previousVersions.length > 0) {
    log("info", "removing previous versions of the extension", {
      previousVersions,
      newPath: info.path,
      paths: previousVersions.map(([_, ext]) => ext.path),
    });
  }

  previousVersions.forEach((key) => api.store.dispatch(removeExtension(key)));
  return previousVersions.map(([key, _]) => key);
}

const requiredThemeFiles = ["variables.scss", "style.scss", "fonts.scss"];

/**
 * validate a theme extension. A theme extension can contain multiple themes, one directory
 * per theme, each is expected to contain at least one of
 * "variables.scss", "style.scss" or "fonts.scss"
 */
async function validateTheme(extPath: string): Promise<void> {
  const entries = await readdir(extPath, { recursive: false, withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());

  if (directories.length === 0)
    throw new DataInvalid("Expected a subdirectory containing the stylesheets");
  const promises = directories.map(async (dir) => {
    const files = await readdir(path.join(dir.parentPath, dir.name), {
      recursive: false,
      withFileTypes: true,
    });
    const hasOneRequiredFile = !!requiredThemeFiles.find((required) =>
      files.find((x) => x.name === required),
    );
    if (!hasOneRequiredFile) throw new DataInvalid("Theme not found");
  });

  await Promise.all(promises);
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
async function validateTranslation(extPath: string): Promise<void> {
  const entries = await readdir(extPath, { withFileTypes: true });
  const languageDirectories = entries.filter(
    (entry) => entry.isDirectory() && isLocaleCode(entry.name),
  );
  if (languageDirectories.length !== 1)
    throw new DataInvalid("Expected exactly one language subdirectory");

  const languageDirectory = languageDirectories[0];

  // the check in isLocaleCode is extremely unreliable because it will fall back to
  // iso on everything. Was it always like that or was that changed in a recent
  // node release?
  const [language, country] = languageDirectory.name.split("-");
  if (!languageExists(language) || (country !== undefined && !countryExists(country))) {
    throw new DataInvalid("Directory isn't a language code");
  }

  const languageEntries = await readdir(
    path.join(extPath, path.join(languageDirectory.parentPath, languageDirectory.name)),
    { withFileTypes: true },
  );
  const hasJSONFile = languageEntries.find((x) => x.isFile() && path.extname(x.name) === ".json");
  if (!hasJSONFile) throw new DataInvalid("No translation files");
}

/**
 * validate an extension. It has to contain an index.js and info.json on the top-level
 */
async function validateExtension(extPath: string): Promise<void> {
  await Promise.all([stat(path.join(extPath, "index.js")), stat(path.join(extPath, "info.json"))]);
}

async function validateInstall(extPath: string, info?: IExtension): Promise<ExtensionType> {
  if (info?.type === "theme") {
    await validateTheme(extPath);
    return "theme";
  }

  if (info?.type === "translation") {
    await validateTranslation(extPath);
    return "translation";
  }

  if (info !== undefined) {
    await validateExtension(extPath);
    return info?.type;
  }

  // if we don't know the type we can only check if _any_ extension type applies
  try {
    await validateExtension(extPath);
    return undefined;
  } catch {
    // ignored
  }

  try {
    await validateTheme(extPath);
    return "theme";
  } catch {
    // ignored
  }

  try {
    await validateTranslation(extPath);
    return "translation";
  } catch {
    // ignored
  }

  throw new DataInvalid(
    "Doesn't seem to contain a correctly packaged extension, theme or translation",
  );
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
        fullInfo.type = await validateInstall(tempPath, info);
      }

      // update the manifest on disc, in case we had new info from the caller
      await writeFile(path.join(tempPath, "info.json"), JSON.stringify(fullInfo, undefined, 2));

      const dirName = sanitize(manifestInfo.id);
      destPath = path.join(extensionsPath, dirName);

      // Keys whose previous-version state entries were marked for removal during
      // this install. Cleared after the rename succeeds so the next launch's
      // state-flag-driven removal path in ExtensionManager doesn't wipe the
      // just-installed folder (#19527).
      const removedKeys = removeOldVersion(api, fullInfo);

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
        await installExtensionDependencies(api, destPath);
      }
    },
  );
}

export default installExtension;
