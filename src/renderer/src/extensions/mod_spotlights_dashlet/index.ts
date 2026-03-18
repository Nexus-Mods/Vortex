import type { IExtensionContext } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import * as fs from "../../util/fs";
import { log } from "../../util/log";
import { ParserError } from "../announcement_dashlet/types";

import path from "path";
import url from "url";
import https from "https";

import type {
  IMOTMEntry,
  ModSpotlightEntry,
  ModSpotlightEntryExt,
  VideoEntryType,
} from "./types";
import ModSpotlightsDashlet from "./ModSpotlightsDashlet";
import { getErrorMessageOrDefault } from "@vortex/shared";

// Can be used for debugging.
const DEBUG_MODE: boolean = false;

/**
 * Do not remove the deprecated entries while Vortex 1.11 - 1.12 are still being
 *  used.
 */
const DEPRECATED_MODS_OF_THE_MONTH_FILENAME = "modsofthemonth.json";

const YOUTUBE_EMBED_URL = `https://www.youtube-nocookie.com/embed/`;

const MOD_SPOTLIGHTS_FILENAME = "modspotlights.json";

const FileMap = {
  modsofthemonth: DEPRECATED_MODS_OF_THE_MONTH_FILENAME,
  modspotlights: MOD_SPOTLIGHTS_FILENAME,
};

const getLocalFilePath = (type: VideoEntryType) =>
  path.join(__dirname, FileMap[type]);

const getFileLink = (type: VideoEntryType) => {
  return `https://raw.githubusercontent.com/Nexus-Mods/Vortex-Backend/main/out/${FileMap[type]}`;
};

async function readLocalFile<T>(type: VideoEntryType): Promise<T[]> {
  const localFilePath = getLocalFilePath(type);
  const data = await fs.readFileAsync(localFilePath, { encoding: "utf8" });
  try {
    const parsed: T[] = JSON.parse(data);
    return Promise.resolve(parsed);
  } catch (err) {
    return Promise.reject(err);
  }
}

function getHTTPData<T>(link: string): Promise<T[]> {
  let sanitizedURL;
  try {
    sanitizedURL = new URL(link);
  } catch (err) {
    return Promise.reject(new Error(`Invalid URL: ${link}`));
  }
  log("info", "getHTTPData", sanitizedURL);
  return new Promise((resolve, reject) => {
    https
      .get(sanitizedURL.href, (res) => {
        res.setEncoding("utf-8");
        let output = "";
        res
          .on("data", (data) => (output += data))
          .on("end", () => {
            try {
              const parsed: T[] = JSON.parse(output);
              resolve(parsed);
            } catch (err) {
              reject(
                new ParserError(
                  err["statusCode"] ?? -1,
                  getErrorMessageOrDefault(err),
                  link,
                  output,
                ),
              );
            }
          });
      })
      .on("error", (e) => {
        reject(e);
      })
      .end();
  });
}

function decorateData<T extends ModSpotlightEntry>(
  data: T[],
): ModSpotlightEntryExt[] {
  const decorated: any[] = [];
  for (const entry of data) {
    decorated.push({
      ...entry,
      link: `${YOUTUBE_EMBED_URL}${entry.videoid}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1`,
    });
  }
  return decorated;
}

export async function update<T extends ModSpotlightEntry>(
  type: VideoEntryType,
): Promise<ModSpotlightEntryExt[]> {
  try {
    let res: T[] = [];
    if (DEBUG_MODE) {
      res = await readLocalFile(type);
    } else {
      res = await getHTTPData<T>(getFileLink(type));
    }
    return decorateData<T>(res as T[]);
  } catch (err) {
    log("warn", "failed to retrieve mod spotlights", err);
    return Promise.resolve([]);
  }
}

function init(context: IExtensionContext): boolean {
  context.registerDashlet(
    "Mods Spotlight",
    1,
    3,
    2,
    ModSpotlightsDashlet,
    (state: IState) => true,
    () => ({
      update: async () => {
        const entries = await Promise.all([
          update<IMOTMEntry>("modsofthemonth"),
          update<ModSpotlightEntry>("modspotlights"),
        ]);
        const flattened = entries.reduce((acc, curr) => acc.concat(curr), []);
        flattened.sort((a, b) => a.date - b.date);

        return flattened;
      },
    }),
    {
      fixed: false,
      closable: true,
    },
  );

  return true;
}

export default init;
