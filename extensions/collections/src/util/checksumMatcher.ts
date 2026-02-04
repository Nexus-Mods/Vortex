import Bluebird from "bluebird";
import * as crc32 from "crc-32";
import * as path from "path";
import { fs, log, selectors, types, util } from "vortex-api";

import { ReplicateHashMismatchError } from "../util/errors";

export async function matchChecksums(
  api: types.IExtensionApi,
  gameId: string,
  modId: string,
): Promise<void> {
  const state = api.getState();
  const mod = state.persistent.mods[gameId][modId];
  if (!mod?.archiveId) {
    throw new util.ProcessCanceled("Mod not found");
  }

  const stagingPath = selectors.installPathForGame(state, gameId);

  const localPath = path.join(stagingPath, mod.installationPath);
  const archive = state.persistent.downloads.files[mod.archiveId!];

  if (archive === undefined) {
    throw new util.ProcessCanceled("Archive not found");
  }

  const rawGame = Array.isArray(archive.game) ? archive.game[0] : archive.game;
  const internalId = rawGame
    ? util.convertGameIdReverse(selectors.knownGames(state), rawGame) || rawGame
    : rawGame;
  const dlPath = selectors.downloadPathForGame(state, internalId);
  const archivePath = path.join(dlPath, archive.localPath!);

  const sourceChecksums: Set<string> = new Set();
  const szip = new util.SevenZip();
  await szip.list(archivePath, undefined, async (entries) => {
    for (const entry of entries) {
      if (entry.attr !== "D") {
        try {
          if (!!entry["crc"]) {
            sourceChecksums.add(entry["crc"].toUpperCase());
          }
        } catch (err) {
          api.showErrorNotification!(
            "Failed to determine checksum for file",
            err,
            {
              message: entry.name,
            },
          );
        }
      }
    }
  });

  let entries: string[] = [];
  await util.walk(
    localPath,
    (input) => {
      return Bluebird.resolve((entries = [].concat(entries, input)));
    },
    {},
  );

  const localChecksums: Set<string> = new Set();
  const computeCRC32Stream = (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      let crc = 0;
      stream.on("data", (chunk: Buffer) => {
        crc = crc32.buf(chunk, crc);
      });
      stream.on("end", () => {
        // >>> 0 converts signed to unsigned
        resolve((crc >>> 0).toString(16).toUpperCase().padStart(8, "0"));
      });
      stream.on("error", (err: Error) => {
        reject(err);
      });
    });
  };

  for (const entry of entries) {
    const isDirectory = (await fs.statAsync(entry)).isDirectory();
    if (isDirectory) {
      continue;
    }
    const crc = await computeCRC32Stream(entry);
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
