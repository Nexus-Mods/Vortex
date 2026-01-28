import Promise from "bluebird";
import * as path from "path";
import { fs, util } from "vortex-api";

function convertGameId(input: string): string {
  if (input === "skyrimse") {
    return "SkyrimSE";
  } else if (input === "falloutnv") {
    return "FalloutNV";
  }
  return input.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
}

function getVirtualFolder(
  userConfig: string,
  gameId: string,
): Promise<string[]> {
  const parser = new DOMParser();

  const xmlDoc = parser.parseFromString(userConfig, "text/xml");

  let item = xmlDoc.querySelector(
    `setting[name="VirtualFolder"] item[modeId="${convertGameId(gameId)}" i] string`,
  );

  if (item === null) {
    return Promise.resolve(undefined);
  }

  const virtualPath = item.textContent;
  let nmmLinkPath = "";

  item = xmlDoc.querySelector(
    `setting[name="HDLinkFolder"] item[modeId="${convertGameId(gameId)}" i] string`,
  );

  if (item !== null) {
    nmmLinkPath = item.textContent;
  }

  item = xmlDoc.querySelector(
    `setting[name="ModFolder"] item[modeId="${convertGameId(gameId)}" i] string`,
  );

  if (item === null) {
    return Promise.resolve(undefined);
  }

  const modsPath = item.textContent;

  const setting = [virtualPath, nmmLinkPath, modsPath, "0"];
  return fs
    .statAsync(modsPath)
    .then((stats) =>
      Promise.resolve([
        virtualPath,
        nmmLinkPath,
        modsPath,
        stats.birthtimeMs.toString(),
      ]),
    )
    .catch((err) => Promise.resolve(setting));
}

function findInstances(gameId: string): Promise<string[][]> {
  const base = path.resolve(
    util.getVortexPath("appData"),
    "..",
    "local",
    "Black_Tree_Gaming",
  );
  return fs
    .readdirAsync(base)
    .filter((fileName: string) =>
      fs
        .statAsync(path.join(base, fileName))
        .then((stat) => stat.isDirectory()),
    )
    .then((instances: string[]) =>
      Promise.map(instances, (instance) =>
        fs
          .readdirAsync(path.join(base, instance))
          .then((versions: string[]) =>
            Promise.map(versions, (version) =>
              fs
                .readFileAsync(
                  path.join(base, instance, version, "user.config"),
                )
                .then((data: Buffer) =>
                  getVirtualFolder(data.toString(), gameId),
                ),
            ),
          ),
      ),
    )
    .then((result) => {
      // remove duplicates, in a case-insensitive way, remove undefined
      const set = result.reduce(
        (prev: { [key: string]: string[] }, value: string[][]) => {
          value.forEach((val) => {
            if (val !== undefined) {
              if (prev[val[0].toUpperCase()] !== undefined) {
                // We found a duplicate entry.. Now we're faced with a problem:
                //  which of these instances is the currently active one ?
                //  - if they're both pointing to the same mods folder, then we're fine.
                //  - if they have different mods folder, we check its creation time -
                //  most recent mods folder MUST be the active one... right?
                const existingVal = prev[val[0].toUpperCase()];
                if (
                  existingVal[2] !== val[2] &&
                  parseInt(existingVal[3], 10) < parseInt(val[3], 10)
                ) {
                  prev[val[0].toUpperCase()] = val;
                }
              } else {
                // Easy - no duplicates.
                prev[val[0].toUpperCase()] = val;
              }
            }
          });
          return prev;
        },
        {},
      );
      return Object.keys(set).map((key) => set[key]);
    })
    .catch((err) =>
      err.code === "ENOENT" ? Promise.resolve([]) : Promise.reject(err),
    );
}

export default findInstances;
