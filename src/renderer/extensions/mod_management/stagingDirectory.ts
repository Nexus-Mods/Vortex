import Bluebird from "bluebird";
import * as path from "path";
import { generate as shortid } from "shortid";
import type { IDialogResult } from "../../types/IDialog";
import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import { getApplication } from "../../util/application";
import { ProcessCanceled, UserCanceled } from "../../util/CustomErrors";
import * as fs from "../../util/fs";
import lazyRequire from "../../util/lazyRequire";
import { log } from "../../util/log";
import { activeGameId, installPathForGame } from "../../util/selectors";
import { getSafe } from "../../util/storeHelper";
import { truthy } from "../../util/util";

import { suggestStagingPath } from "../gamemode_management/util/discovery";

import { setInstallPath } from "./actions/settings";
import { fallbackPurge } from "./util/activationStore";
import { resolveInstallPath } from "./util/getInstallPath";

import type * as winapiT from "winapi-bindings";
import { isErrorWithSystemCode, unknownToError } from "@vortex/shared";

const winapi: typeof winapiT = lazyRequire(() => require("winapi-bindings"));

export const STAGING_DIR_TAG = "__vortex_staging_folder";

function writeStagingTag(api: IExtensionApi, tagPath: string, gameId: string) {
  const state: IState = api.store.getState();
  const data = {
    instance: state.app.instanceId,
    game: gameId,
  };
  return fs.writeFileAsync(tagPath, JSON.stringify(data), { encoding: "utf8" });
}

function validateStagingTag(
  api: IExtensionApi,
  tagPath: string,
): Bluebird<void> {
  return fs
    .readFileAsync(tagPath, { encoding: "utf8" })
    .then((data) => {
      const state: IState = api.store.getState();
      const tag = JSON.parse(data);
      if (tag.instance !== state.app.instanceId) {
        return api
          .showDialog(
            "question",
            "Confirm",
            {
              text:
                "This is a staging folder but it appears to belong to a different Vortex " +
                'instance. If you\'re using Vortex in shared and "regular" mode, do not use ' +
                "the same staging folder for both!",
            },
            [{ label: "Cancel" }, { label: "Continue" }],
          )
          .then((result) =>
            result.action === "Cancel"
              ? Bluebird.reject(new UserCanceled())
              : Bluebird.resolve(),
          );
      }
      return Bluebird.resolve();
    })
    .catch((err) => {
      if (err instanceof UserCanceled) {
        return Bluebird.reject(err);
      }
      return api
        .showDialog(
          "question",
          "Confirm",
          {
            text:
              "This directory is not marked as a staging folder. " +
              "Are you *sure* it's the right directory?",
          },
          [{ label: "Cancel" }, { label: "I'm sure" }],
        )
        .then((result) =>
          result.action === "Cancel"
            ? Bluebird.reject(new UserCanceled())
            : Bluebird.resolve(),
        );
    });
}

function queryStagingFolderInvalid(
  api: IExtensionApi,
  err: Error,
  dirExists: boolean,
  instPath: string,
): Bluebird<IDialogResult> {
  if (dirExists) {
    // dir exists but not tagged
    return api.showDialog(
      "error",
      "Mod Staging Folder invalid",
      {
        bbcode:
          'Your mod staging folder "{{path}}" is not marked correctly. This may be ok ' +
          "if you've updated from a very old version of Vortex and you can ignore this.<br/>" +
          "[b]However[/b], if you use a removable medium (network or USB drive) and that path " +
          "does not actually point to your real staging folder, you [b]have[/b] " +
          "to make sure the actual folder is available and tell Vortex where it is.",
        message: err.message,
        parameters: {
          path: instPath,
        },
      },
      [{ label: "Quit Vortex" }, { label: "Ignore" }, { label: "Browse..." }],
    );
  }
  return api.showDialog(
    "error",
    "Mod Staging Folder missing!",
    {
      text:
        'Your mod staging folder "{{path}}" is missing. This might happen because you ' +
        "deleted it or - if you have it on a removable drive - it is not currently " +
        "connected.\nIf you continue now, a new staging folder will be created but all " +
        "your previously managed mods will be lost.\n\n" +
        "If you have moved the folder or the drive letter changed, you can browse " +
        "for the new location manually, but please be extra careful to select the right " +
        "folder!",
      message: instPath,
      parameters: {
        path: instPath,
      },
    },
    [
      { label: "Quit Vortex" },
      { label: "Reinitialize" },
      { label: "Browse..." },
    ],
  );
}

async function ensureStagingDirectoryImpl(
  api: IExtensionApi,
  instPath?: string,
  gameId?: string,
): Promise<string> {
  const state = api.getState();
  if (gameId === undefined) {
    gameId = activeGameId(state);
  }

  if (instPath === undefined) {
    // no staging folder set yet
    if (state.settings.mods.installPathMode === "suggested") {
      instPath = resolveInstallPath(
        await suggestStagingPath(api, gameId),
        gameId,
      );
      api.store.dispatch(setInstallPath(gameId, instPath));
    } else {
      instPath = installPathForGame(state, gameId);
    }
  }

  let partitionExists = true;
  try {
    winapi.GetVolumePathName(instPath);
  } catch (err) {
    // On Windows, error number 2 (0x2) translates to ERROR_FILE_NOT_FOUND.
    //  the only way for this error to be reported at this point is when
    //  the destination path is pointing towards a non-existing partition.
    // If it's a non-existing partition, we want the reinitialization dialog
    //  to appear so that the user can re-configure his game's staging folder.
    if (isErrorWithSystemCode(err) && err.systemCode === 2) {
      partitionExists = false;
    }
  }
  let dirExists = false;

  try {
    await fs.statAsync(instPath);
    dirExists = true;
    // staging dir exists, does the tag exist?
    await fs.statAsync(path.join(instPath, STAGING_DIR_TAG));
  } catch (unknownError) {
    const mods = getSafe(state, ["persistent", "mods", gameId], undefined);
    if (partitionExists === true && dirExists === false && mods === undefined) {
      // If the mods state branch for this game is undefined - this must be the
      //  first time we manage this game - just create the staging path.
      //
      // This code should never be hit because the directory is created in
      // profile_management/index.ts as soon as we start managing the game for the
      // first time but we probably still don't want to report an error if we have
      // no meta information about any mods anyway
      await fs.ensureDirWritableAsync(instPath, () => Bluebird.resolve());
    } else {
      const err = unknownToError(unknownError);
      const dialogResult = await queryStagingFolderInvalid(
        api,
        err,
        dirExists,
        instPath,
      );
      if (dialogResult.action === "Quit Vortex") {
        getApplication().quit(0);
        throw new UserCanceled();
      } else if (dialogResult.action === "Reinitialize") {
        const id = shortid();
        api.sendNotification({
          id,
          type: "activity",
          message: "Purging mods",
        });
        try {
          // Wrap Bluebird promise to ensure proper error handling with try/catch
          await new Promise<void>((resolve, reject) => {
            fallbackPurge(api, gameId).then(resolve).catch(reject);
          });
          await fs.ensureDirWritableAsync(instPath, () => Bluebird.resolve());
        } catch (purgeErr) {
          if (!partitionExists) {
            // Can't purge a non-existing partition!
            throw new ProcessCanceled("Invalid/Missing partition");
          }
          if (purgeErr instanceof ProcessCanceled) {
            log("warn", "Mods not purged", purgeErr.message);
          } else {
            api.showDialog(
              "error",
              "Mod Staging Folder missing!",
              {
                bbcode:
                  "The staging folder could not be created. " +
                  "You [b][color=red]have[/color][/b] to go to settings->mods and change it " +
                  "to a valid directory [b][color=red]before doing anything else[/color][/b] " +
                  "or you will get further error messages.",
              },
              [{ label: "Close" }],
            );
          }
          throw new ProcessCanceled("Not purged");
        }
        api.dismissNotification(id);
      } else if (dialogResult.action === "Ignore") {
        // nop
      } else {
        // Browse...
        const selectedPath = await api.selectDir({
          defaultPath: instPath,
          title: api.translate("Select staging folder"),
        });

        if (!truthy(selectedPath)) {
          return ensureStagingDirectoryImpl(api, instPath, gameId);
        }

        try {
          await validateStagingTag(
            api,
            path.join(selectedPath, STAGING_DIR_TAG),
          );
          instPath = selectedPath;
          api.store.dispatch(setInstallPath(gameId, instPath));
        } catch (validateErr) {
          await ensureStagingDirectory(api, instPath, gameId);
        }
      }
    }
  }

  await writeStagingTag(api, path.join(instPath, STAGING_DIR_TAG), gameId);
  return instPath;
}

export function ensureStagingDirectory(
  api: IExtensionApi,
  instPath?: string,
  gameId?: string,
): Bluebird<string> {
  return Bluebird.resolve(ensureStagingDirectoryImpl(api, instPath, gameId));
}
