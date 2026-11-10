import * as path from "path";

import { unknownToError } from "@vortex/shared";
import Bluebird from "bluebird";
import SevenZip from "node-7z";

import { convertGameIdReverse } from "../../../extensions/nexus_integration/util/convertGameId";
import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { ProcessCanceled } from "../../../util/CustomErrors";
import * as fs from "../../../util/fs";
import * as selectors from "../../../util/selectors";
import walk from "../../../util/walk";
import { ReplicateHashMismatchError } from "../util/errors";
import { fileCRC32 } from "./fileCRC";

export async function matchChecksums(
  api: IExtensionApi,
  gameId: string,
  modId: string,
): Promise<void> {
  const state = api.getState();
  const mod = state.persistent.mods[gameId][modId];
  if (!mod?.archiveId) {
    throw new ProcessCanceled("Mod not found");
  }

  const stagingPath = selectors.installPathForGame(state, gameId);

  const localPath = path.join(stagingPath, mod.installationPath);
  const archive = state.persistent.downloads.files[mod.archiveId];

  if (archive === undefined) {
    throw new ProcessCanceled("Archive not found");
  }

  const rawGame = Array.isArray(archive.game) ? archive.game[0] : archive.game;
  const internalId = rawGame
    ? convertGameIdReverse(selectors.knownGames(state), rawGame) || rawGame
    : rawGame;
  const dlPath = selectors.downloadPathForGame(state, internalId);
  const archivePath = path.join(dlPath, archive.localPath);

  const sourceChecksums: Set<string> = new Set();
  const szip = new SevenZip();
  await szip.list(archivePath, undefined, async (entries) => {
    for (const entry of entries) {
      if (entry.attr !== "D") {
        try {
          if (entry["crc"]) {
            sourceChecksums.add(entry["crc"].toUpperCase());
          }
        } catch (err) {
          api.showErrorNotification("Failed to determine checksum for file", unknownToError(err), {
            message: entry.name,
          });
        }
      }
    }
  });

  let entries: string[] = [];
  await walk(
    localPath,
    (input) => {
      return Bluebird.resolve((entries = [].concat(entries, input)));
    },
    {},
  );

  const localChecksums: Set<string> = new Set();
  for (const entry of entries) {
    const isDirectory = (await fs.statAsync(entry)).isDirectory();
    if (isDirectory) {
      continue;
    }
    const crc = await fileCRC32(entry);
    localChecksums.add(crc);
  }

  const missingChecksums: string[] = [];
  for (const crc of localChecksums) {
    if (!sourceChecksums.has(crc)) {
      missingChecksums.push(crc);
    }
  }

  if (missingChecksums.length > 0) {
    throw new ReplicateHashMismatchError();
  }
}
