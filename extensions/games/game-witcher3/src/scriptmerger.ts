/* eslint-disable */
import https from "https";
import path from "path";
import url from "url";

import { actions, fs, types, log, util } from "@nexusmods/vortex-api";
import _ from "lodash";
import { Builder, parseStringPromise } from "xml2js";

import { extractionProblem } from "./mergerInstall";
import { isMergerToolValidForRoot, mergerDirForRoot } from "./mergerPaths";
import { latestMergerRelease, mergerDownloadProblem } from "./mergerRelease";
import { IIncomingGithubHttpHeaders } from "./types";
import { fileExists, shouldNotifyMissingScriptMerger } from "./util";

const GITHUB_URL = "https://api.github.com/repos/IDCs/WitcherScriptMerger";

const MERGER_CONFIG_FILE = "WitcherScriptMerger.exe.config";

const { SCRIPT_MERGER_FILES, SCRIPT_MERGER_ID, SCRIPT_MERGER_RELEASES_URL } = require("./common");

function query(baseUrl, request) {
  return new Promise((resolve, reject) => {
    const relUrl = url.parse(`${baseUrl}/${request}`);
    const options = {
      ..._.pick(relUrl, ["port", "hostname", "path"]),
      headers: {
        "User-Agent": "Vortex",
      },
    };

    https
      .get(options, (res) => {
        res.setEncoding("utf-8");
        const headers = res.headers as IIncomingGithubHttpHeaders;
        const callsRemaining = parseInt(headers?.["x-ratelimit-remaining"], 10);
        if (res.statusCode === 403 && callsRemaining === 0) {
          const resetDate = parseInt(headers?.["x-ratelimit-reset"], 10) * 1000;
          log("info", "GitHub rate limit exceeded", { reset_at: new Date(resetDate).toString() });
          return reject(new util.ProcessCanceled("GitHub rate limit exceeded"));
        }

        let output = "";
        res
          .on("data", (data) => (output += data))
          .on("end", () => {
            try {
              return resolve(JSON.parse(output));
            } catch (parseErr) {
              return reject(parseErr);
            }
          });
      })
      .on("error", (err) => {
        return reject(err);
      })
      .end();
  });
}

function getRequestOptions(link) {
  const relUrl = url.parse(link);
  return {
    ..._.pick(relUrl, ["port", "hostname", "path"]),
    headers: {
      "User-Agent": "Vortex",
    },
  };
}

async function downloadConsent(api: types.IExtensionApi) {
  return new Promise<void>((resolve, reject) => {
    api.showDialog(
      "info",
      "Witcher 3 Script Merger",
      {
        bbcode: api.translate(
          "Many Witcher 3 mods add or edit game scripts. When several mods " +
            "editing the same script are installed, these mods need to be merged using a tool " +
            "called Witcher 3 Script Merger. Vortex can attempt to download and configure the merger " +
            "for you automatically - before doing so - please ensure your account has full read/write permissions " +
            "to your game's directory. The script merger can be installed at a later point if you wish. [br][/br][br][/br]" +
            "[url=https://wiki.nexusmods.com/index.php/Tool_Setup:_Witcher_3_Script_Merger]find out more about the script merger.[/url][br][/br][br][/br]" +
            "Note: While script merging works well with the vast majority of mods, there is no guarantee for a satisfying outcome in every single case.",
          { ns: "game-witcher3" },
        ),
      },
      [
        { label: "Cancel", action: () => reject(new util.UserCanceled()) },
        { label: "Download", action: () => resolve() },
      ],
    );
  });
}

/** A downloaded merger that can't be installed; the user is sent to the manual install. */
class UnusableMergerDownloadError extends Error {}

async function onDownloadComplete(api, archivePath, mostRecentVersion) {
  let mergerPath;
  try {
    mergerPath = await extractScriptMerger(api, archivePath);
  } catch (err) {
    log("error", "failed to extract script merger", err);
    throw new UnusableMergerDownloadError("extraction failed");
  }
  if (!(await fileExists(path.join(mergerPath, SCRIPT_MERGER_FILES[0])))) {
    throw new UnusableMergerDownloadError(`archive has no ${SCRIPT_MERGER_FILES[0]}`);
  }
  return setUpMerger(api, mostRecentVersion, mergerPath);
}

export async function getScriptMergerDir(api, create = false) {
  const state = api.getState();
  const discovery = util.getSafe(
    state,
    ["settings", "gameMode", "discovered", "witcher3"],
    undefined,
  );
  if (discovery?.path === undefined) {
    return undefined;
  }
  const toolPath: string | undefined = discovery.tools?.W3ScriptMerger?.path;
  try {
    if (!toolPath) {
      throw new Error("Script Merger not set up");
    }
    // Existing on disk isn't enough: a path left over from another install
    // stats fine and would merge the wrong scripts into the wrong Mods folder.
    if (!isMergerToolValidForRoot(toolPath, discovery.path)) {
      throw new util.ProcessCanceled("Script Merger belongs to another install");
    }
    await fs.statAsync(toolPath);
    return path.dirname(toolPath);
  } catch (err) {
    const defaultPath = mergerDirForRoot(discovery.path);
    if (create) {
      await fs.ensureDirWritableAsync(defaultPath);
    }
    return defaultPath;
  }
}

export async function downloadScriptMerger(api: types.IExtensionApi) {
  const state = api.store.getState();
  const discovery = util.getSafe(
    state,
    ["settings", "gameMode", "discovered", "witcher3"],
    undefined,
  );
  if (discovery?.path === undefined) {
    return Promise.reject(new util.SetupError("Witcher3 is not discovered"));
  }
  const toolPath: string | undefined = discovery.tools?.[SCRIPT_MERGER_ID]?.path;
  if (
    toolPath !== undefined &&
    isMergerToolValidForRoot(toolPath, discovery.path) &&
    (await fileExists(toolPath))
  ) {
    // A merger is already set up for this install, whichever one the user chose.
    return;
  }
  let mostRecentVersion;
  const downloadNotifId = "download-script-merger-notif";
  return query(GITHUB_URL, "releases")
    .then((releases) => {
      if (!Array.isArray(releases)) {
        return Promise.reject(new util.DataInvalid("expected array of github releases"));
      }
      const latest = latestMergerRelease(releases);
      if (latest === undefined) {
        return Promise.reject(new util.DataInvalid("no installable script merger release"));
      }

      return Promise.resolve(latest);
    })
    .then(async (latest) => {
      const { version, fileName, downloadLink } = latest;
      mostRecentVersion = version;

      const downloadNotif: types.INotification = {
        id: downloadNotifId,
        type: "activity",
        title: "Adding Script Merger",
        message: "This may take a minute...",
      };
      const download = async () => {
        api.sendNotification({
          ...downloadNotif,
          progress: 0,
        });
        let redirectionURL;
        redirectionURL = await new Promise((resolve, reject) => {
          const options = getRequestOptions(downloadLink);
          https
            .request(options, (res) => {
              return res.headers["location"] !== undefined
                ? resolve(res.headers["location"])
                : reject(new util.ProcessCanceled("Failed to resolve download location"));
            })
            .on("error", (err) => reject(err))
            .end();
        });
        return new Promise((resolve, reject) => {
          const options = getRequestOptions(redirectionURL);
          https
            .request(options, (res) => {
              res.setEncoding("binary");
              const headers = res.headers as IIncomingGithubHttpHeaders;
              const contentLength = parseInt(headers?.["content-length"], 10);
              const callsRemaining = parseInt(headers?.["x-ratelimit-remaining"], 10);
              if (res.statusCode === 403 && callsRemaining === 0) {
                const resetDate = parseInt(headers?.["x-ratelimit-reset"], 10) * 1000;
                log("info", "GitHub rate limit exceeded", {
                  reset_at: new Date(resetDate).toString(),
                });
                return reject(new util.ProcessCanceled("GitHub rate limit exceeded"));
              }

              let output = "";
              res
                .on("data", (data) => {
                  output += data;
                  if (output.length % 500 === 0) {
                    // Updating the notification is EXTREMELY expensive.
                    //  the length % 500 === 0 line ensures this is not done too
                    //  often.
                    api.sendNotification({
                      ...downloadNotif,
                      progress: (output.length / contentLength) * 100,
                    });
                  }
                })
                .on("end", () => {
                  const problem = mergerDownloadProblem(res.statusCode, output.length, latest);
                  if (problem !== undefined) {
                    return reject(new UnusableMergerDownloadError(problem));
                  }
                  api.sendNotification({
                    ...downloadNotif,
                    progress: 100,
                  });
                  api.dismissNotification(downloadNotifId);
                  return fs
                    .writeFileAsync(path.join(discovery.path, fileName), output, {
                      encoding: "binary",
                    })
                    .then(() => resolve(path.join(discovery.path, fileName)))
                    .catch((err) => reject(err));
                });
            })
            .on("error", (err) => reject(err))
            .end();
        });
      };

      return downloadConsent(api).then(() => download());
    })
    .then((archivePath) => onDownloadComplete(api, archivePath, mostRecentVersion))
    .catch(async (err) => {
      const raiseManualInstallNotif = () => {
        log("error", "Failed to automatically install Script Merger", err.message);
        if (!shouldNotifyMissingScriptMerger(api)) {
          // Nothing to chase on the remaster - mods there merge themselves.
          return;
        }
        api.sendNotification({
          type: "error",
          message: api.translate("Please install Script Merger manually", { ns: "game-witcher3" }),
          actions: [
            {
              title: "Install Manually",
              action: () => util.opn(SCRIPT_MERGER_RELEASES_URL).catch((err) => null),
            },
          ],
        });
      };
      api.dismissNotification(extractNotifId);
      api.dismissNotification(downloadNotifId);
      if (err instanceof UnusableMergerDownloadError) {
        raiseManualInstallNotif();
        return Promise.resolve();
      }
      if (err instanceof util.UserCanceled) {
        return Promise.resolve();
      } else if (err instanceof util.ProcessCanceled) {
        if (err.message.startsWith("Failed to resolve download location")) {
          // Currently AFAIK this would only occur if github is down for any reason
          //  and we were unable to resolve the re-direction link. Given that this
          //  will most certainly resolve itself eventually - we log this and keep going.
          log("info", "failed to resolve W3 script merger re-direction link", err);
          return Promise.resolve();
        } else if (err.message.startsWith("Game is not discovered")) {
          raiseManualInstallNotif();
          return Promise.resolve();
        }
      } else {
        return Promise.reject(err);
      }
    });
}

const extractNotifId = "extracting-script-merger";
const extractNotif = {
  id: extractNotifId,
  type: "activity",
  title: "Extracting Script Merger",
};
async function extractScriptMerger(api, archivePath) {
  const destination = await getScriptMergerDir(api, true);
  if (destination === undefined) {
    // How ?
    return Promise.reject(new util.ProcessCanceled("Game is not discovered"));
  }
  const sZip = new util.SevenZip();
  api.sendNotification(extractNotif);
  const result = await sZip.extractFull(archivePath, destination);
  const problem = extractionProblem(result);
  if (problem !== undefined) {
    throw new Error(problem);
  }
  api.sendNotification({
    type: "info",
    message: api.translate("W3 Script Merger extracted successfully", { ns: "game-witcher3" }),
  });
  api.dismissNotification(extractNotifId);
  return Promise.resolve(destination);
}

async function setUpMerger(api, mergerVersion, newPath) {
  const state = api.store.getState();
  const discovery = util.getSafe(
    state,
    ["settings", "gameMode", "discovered", "witcher3"],
    undefined,
  );
  const currentDetails = discovery?.tools?.W3ScriptMerger;

  const newToolDetails = !!currentDetails
    ? { ...currentDetails, mergerVersion }
    : {
        id: SCRIPT_MERGER_ID,
        name: "W3 Script Merger",
        logo: "WitcherScriptMerger.jpg",
        executable: () => "WitcherScriptMerger.exe",
        requiredFiles: ["WitcherScriptMerger.exe"],
        mergerVersion,
      };
  newToolDetails.path = path.join(newPath, "WitcherScriptMerger.exe");
  newToolDetails.workingDirectory = newPath;
  await setMergerConfig(discovery.path, newPath);
  api.store.dispatch(actions.addDiscoveredTool("witcher3", SCRIPT_MERGER_ID, newToolDetails, true));
  return Promise.resolve();
}

/**
 * Points the script merger at the install that is currently discovered.
 *
 * Both editions are managed under one game entry, so the stored tool and the
 * merger's own config survive a switch between them. The merger compiles against
 * one edition's vanilla scripts and keeps its merge state in MergeInventory.xml
 * beside its exe, so each game root gets its own copy rather than sharing one.
 */
export async function repairStaleScriptMerger(
  api: types.IExtensionApi,
  discovery: types.IDiscoveryResult,
): Promise<void> {
  const toolPath = discovery?.tools?.[SCRIPT_MERGER_ID]?.path;
  if (discovery?.path === undefined || toolPath === undefined) {
    return;
  }

  const expectedDir = mergerDirForRoot(discovery.path);
  if (isMergerToolValidForRoot(toolPath, discovery.path)) {
    // Right merger, but its config records whichever root it was set up for.
    await setMergerConfig(discovery.path, path.dirname(toolPath));
    return;
  }

  const expectedExe = path.join(expectedDir, "WitcherScriptMerger.exe");
  const installed = await fs
    .statAsync(expectedExe)
    .then(() => true)
    .catch(() => false);

  log("info", "witcher3 script merger belongs to another install, re-pointing", {
    from: toolPath,
    to: expectedDir,
    installed,
  });

  // Pointed at the executable only when it is there. Naming a path that is not
  // leaves the tool looking configured, so it fails on run and the download
  // treats it as already current.
  const newToolDetails = {
    ...discovery.tools[SCRIPT_MERGER_ID],
    path: installed ? expectedExe : undefined,
    workingDirectory: installed ? expectedDir : undefined,
    mergerVersion: installed ? discovery.tools[SCRIPT_MERGER_ID]["mergerVersion"] : undefined,
  };

  api.store.dispatch(actions.addDiscoveredTool("witcher3", SCRIPT_MERGER_ID, newToolDetails, true));

  if (installed) {
    await setMergerConfig(discovery.path, expectedDir);
  } else {
    api.sendNotification({
      id: "w3-merger-repointed",
      type: "info",
      message: "Script Merger needs setting up again for this copy of the game.",
      allowSuppress: false,
    });
  }
}

export async function getMergedModName(scriptMergerPath) {
  const configFilePath = path.join(scriptMergerPath, MERGER_CONFIG_FILE);
  try {
    const data = await fs.readFileAsync(configFilePath, { encoding: "utf8" });
    const config = await parseStringPromise(data);
    const configItems = config?.configuration?.appSettings?.[0]?.add;
    const MergedModName = configItems?.find((item) => item.$?.key === "MergedModName") ?? undefined;
    if (!!MergedModName?.$?.value) {
      return MergedModName.$.value;
    }
  } catch (err) {
    // This is probably a sign of a corrupt script merger installation....
    log("error", 'failed to ascertain merged mod name - using "mod0000_MergedFiles"', err);
    return "mod0000_MergedFiles";
  }
}

export async function setMergerConfig(gameRootPath, scriptMergerPath) {
  // findIndex reports a miss as -1, which is a valid-looking array index right
  // up until the assignment throws and leaves the config half rewritten.
  const findIndex = (nodes, id) => {
    const idx = nodes?.findIndex((iter) => iter.$?.key === id) ?? -1;
    return idx >= 0 ? idx : undefined;
  };

  const configFilePath = path.join(scriptMergerPath, MERGER_CONFIG_FILE);
  try {
    const data = await fs.readFileAsync(configFilePath, { encoding: "utf8" });
    const config = await parseStringPromise(data);
    const replaceElement = (id, replacement) => {
      const idx = findIndex(config?.configuration?.appSettings?.[0]?.add, id);
      if (idx !== undefined) {
        config.configuration.appSettings[0].add[idx].$ = { key: id, value: replacement };
      }
    };

    replaceElement("GameDirectory", gameRootPath);
    replaceElement(
      "VanillaScriptsDirectory",
      path.join(gameRootPath, "content", "content0", "scripts"),
    );
    replaceElement("ModsDirectory", path.join(gameRootPath, "mods"));
    const builder = new Builder();
    const xml = builder.buildObject(config);
    await fs.writeFileAsync(configFilePath, xml);
  } catch (err) {
    // Guess the user will have to set up the merger configuration
    //  through the merger directly.
    return;
  }
}
