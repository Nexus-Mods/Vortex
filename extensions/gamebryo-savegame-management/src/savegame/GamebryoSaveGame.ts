import * as fs from "fs";
import * as path from "path";

import { BinaryReader } from "./BinaryReader";

export interface Dimensions {
  width: number;
  height: number;
}

export interface SaveGameData {
  characterName: string;
  characterLevel: number;
  location: string;
  saveNumber: number;
  creationTime: number;
  playTime: string;
  plugins: string[];
  screenshotSize: Dimensions;
  screenshot: Buffer;
  fileName: string;
}

interface WINSYSTEMTIME {
  wYear: number;
  wMonth: number;
  wDayOfWeek: number;
  wDay: number;
  wHour: number;
  wMinute: number;
  wSecond: number;
  wMilliseconds: number;
}

function windowsTicksToEpoch(windowsTicks: bigint): number {
  const WINDOWS_TICK = 10000000n;
  const SEC_TO_UNIX_EPOCH = 11644473600n;
  return Number(windowsTicks / WINDOWS_TICK - SEC_TO_UNIX_EPOCH);
}

function readWINSYSTEMTIME(reader: BinaryReader): WINSYSTEMTIME {
  return {
    wYear: reader.readUint16(),
    wMonth: reader.readUint16(),
    wDayOfWeek: reader.readUint16(),
    wDay: reader.readUint16(),
    wHour: reader.readUint16(),
    wMinute: reader.readUint16(),
    wSecond: reader.readUint16(),
    wMilliseconds: reader.readUint16(),
  };
}

function systemTimeToEpoch(st: WINSYSTEMTIME): number {
  // C++ mktime() interprets as local time, so we must too
  const d = new Date(st.wYear, st.wMonth - 1, st.wDay, st.wHour, st.wMinute, st.wSecond);
  return Math.floor(d.getTime() / 1000);
}

/**
 * Heuristic: if >50% of non-numeric characters in the filename are Cyrillic,
 * assume the save content uses Windows-1251 encoding.
 */
function determineEncoding(fileName: string): string {
  const nameOnly = fileName.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "");
  const relevant = nameOnly.replace(/[0-9.\- ]/g, "");
  if (relevant.length === 0) return "utf8";

  let cyrillicCount = 0;
  for (const ch of relevant) {
    const code = ch.charCodeAt(0);
    if (code >= 0x400 && code <= 0x52f) cyrillicCount++;
  }

  if ((cyrillicCount * 100) / relevant.length > 50) {
    return "windows-1251";
  }
  return "utf8";
}

function readOblivion(reader: BinaryReader, quickRead: boolean): Partial<SaveGameData> {
  reader.setBZString(true);

  reader.skip(1); // Major version
  reader.skip(1); // Minor version
  reader.skip(16); // WINSYSTEMTIME (exe last modified)
  reader.skip(4); // Header version
  reader.skip(4); // Header size

  const saveNumber = reader.readUint32();
  const characterName = reader.readString();
  const characterLevel = reader.readUint16();
  const location = reader.readString();

  const gameDays = reader.readFloat();
  const playTime = Math.floor(gameDays) + " days, " + (Math.floor(gameDays * 24) % 24) + " hours";

  reader.skip(4); // game ticks

  const winTime = readWINSYSTEMTIME(reader);
  const creationTime = systemTimeToEpoch(winTime);

  let plugins: string[] = [];
  let screenshotSize: Dimensions = { width: 0, height: 0 };
  let screenshot: Buffer = Buffer.alloc(0);

  if (!quickRead) {
    reader.skip(4); // Screenshot size
    const img = reader.readImage();
    screenshotSize = { width: img.width, height: img.height };
    screenshot = img.data;
    plugins = reader.readPlugins(true);
  }

  return {
    characterName,
    characterLevel,
    location,
    saveNumber,
    creationTime,
    playTime,
    plugins,
    screenshotSize,
    screenshot,
  };
}

function readSkyrim(reader: BinaryReader, quickRead: boolean): Partial<SaveGameData> {
  reader.skip(4); // header size
  const version = reader.readUint32(); // header version
  const saveNumber = reader.readUint32();

  const characterName = reader.readString();
  const characterLevel = reader.readUint32();
  const location = reader.readString();
  const playTime = reader.readString();

  reader.readString(); // race name
  reader.skip(2); // Player gender
  reader.skip(4); // experience gathered
  reader.skip(4); // experience required

  const ftime = reader.readInt64();
  const creationTime = windowsTicksToEpoch(ftime);

  let plugins: string[] = [];
  let screenshotSize: Dimensions = { width: 0, height: 0 };
  let screenshot: Buffer = Buffer.alloc(0);

  if (!quickRead) {
    if (version < 0x0c) {
      // Original Skyrim
      const img = reader.readImage();
      screenshotSize = { width: img.width, height: img.height };
      screenshot = img.data;
    } else {
      // Skyrim SE — has compression
      const width = reader.readUint32();
      const height = reader.readUint32();
      const compressionFormat = reader.readUint16();

      const img = reader.readImage(width, height, true);
      screenshotSize = { width: img.width, height: img.height };
      screenshot = img.data;

      const uncompressedSize = reader.readUint32();
      const compressedSize = reader.readUint32();
      reader.setCompression(compressionFormat, compressedSize, uncompressedSize);
    }

    const formVersion = reader.readUint8();
    reader.skip(4); // plugin info size
    plugins = reader.readPlugins();

    if (formVersion >= 0x4e) {
      plugins = plugins.concat(reader.readLightPlugins());
    }
  }

  return {
    characterName,
    characterLevel,
    location,
    saveNumber,
    creationTime,
    playTime,
    plugins,
    screenshotSize,
    screenshot,
  };
}

function readFO3(reader: BinaryReader, quickRead: boolean): Partial<SaveGameData> {
  reader.skip(4); // Save header size
  reader.skip(4); // File version (always 0x30)
  reader.skip(1); // Delimiter

  // New Vegas detection heuristic:
  // Read bytes until we find 0x7c. If 5 bytes were read, it's New Vegas.
  // If 4 bytes, it's FO3.
  const pos = reader.tell();
  let fieldSize = 0;
  while (reader.readUint8() !== 0x7c) {
    fieldSize++;
  }
  // We consumed fieldSize bytes + the 0x7c marker itself via readUint8 calls
  // But readUint8 doesn't consume field markers here since hasFieldMarkers is false
  // fieldSize counts the non-0x7c bytes. The 0x7c was also consumed.

  if (fieldSize === 4) {
    // FO3: the field was only 4 bytes, seek back since we need it
    // Actually we read fieldSize+1 bytes (including the 0x7c).
    // For FO3 we need to go back to pos to re-read the 4-byte field
    reader.seek(pos);
  }
  // For NV (fieldSize === 5): we already consumed the unknown string + separator, stay here

  reader.setFieldMarkers(true);

  const width = reader.readUint32();
  const height = reader.readUint32();
  const saveNumber = reader.readUint32();
  const characterName = reader.readString();
  reader.readString(); // unknown string
  const characterLevel = reader.readInt32();
  const location = reader.readString();
  const playTime = reader.readString();

  let plugins: string[] = [];
  let screenshotSize: Dimensions = { width: 0, height: 0 };
  let screenshot: Buffer = Buffer.alloc(0);

  if (!quickRead) {
    const img = reader.readImage(width, height);
    screenshotSize = { width: img.width, height: img.height };
    screenshot = img.data;

    reader.skip(5); // unknown byte + plugin data size
    plugins = reader.readPlugins();
  }

  return {
    characterName,
    characterLevel,
    location,
    saveNumber,
    creationTime: 0,
    playTime,
    plugins,
    screenshotSize,
    screenshot,
  };
}

function readFO4(reader: BinaryReader, quickRead: boolean): Partial<SaveGameData> {
  reader.skip(4); // header size
  reader.skip(4); // header version
  const saveNumber = reader.readUint32();

  const characterName = reader.readString();
  const characterLevel = reader.readUint32();
  const location = reader.readString();
  const playTime = reader.readString();
  reader.readString(); // race name

  reader.skip(2); // Player gender
  reader.skip(4); // experience gathered
  reader.skip(4); // experience required

  const ftime = reader.readInt64();
  const creationTime = windowsTicksToEpoch(ftime);

  let plugins: string[] = [];
  let screenshotSize: Dimensions = { width: 0, height: 0 };
  let screenshot: Buffer = Buffer.alloc(0);

  if (!quickRead) {
    const img = reader.readImage(undefined, undefined, true);
    screenshotSize = { width: img.width, height: img.height };
    screenshot = img.data;

    const formVersion = reader.readUint8();
    reader.readString(); // game version
    reader.skip(4); // plugin info size
    plugins = reader.readPlugins();

    if (formVersion >= 0x44) {
      plugins = plugins.concat(reader.readLightPlugins());
    }
  }

  return {
    characterName,
    characterLevel,
    location,
    saveNumber,
    creationTime,
    playTime,
    plugins,
    screenshotSize,
    screenshot,
  };
}

const HEADERS: Array<[string, (r: BinaryReader, q: boolean) => Partial<SaveGameData>]> = [
  ["TES4SAVEGAME", readOblivion],
  ["TESV_SAVEGAME", readSkyrim],
  ["FO3SAVEGAME", readFO3],
  ["FO4_SAVEGAME", readFO4],
];

// Quick read only needs the first ~256 bytes of header metadata.
// Reading 4KB avoids loading multi-MB files just to parse a few fields.
const QUICK_READ_BYTES = 4096;

export function parseSaveGame(filePath: string, quickRead: boolean): SaveGameData {
  let buf: Buffer;
  if (quickRead) {
    const fd = fs.openSync(filePath, "r");
    try {
      buf = Buffer.alloc(QUICK_READ_BYTES);
      fs.readSync(fd, buf, 0, QUICK_READ_BYTES, 0);
    } finally {
      fs.closeSync(fd);
    }
  } else {
    buf = fs.readFileSync(filePath);
  }
  const reader = new BinaryReader(buf);

  const encoding = determineEncoding(filePath);
  reader.setEncoding(encoding);

  let result: Partial<SaveGameData> | null = null;

  for (const [header, readFn] of HEADERS) {
    if (reader.checkHeader(header)) {
      result = readFn(reader, quickRead);
      break;
    }
  }

  if (!result) {
    throw new Error("invalid file header");
  }

  // Fallback: use file mtime if no creation time was parsed
  if (!result.creationTime) {
    try {
      const stat = fs.statSync(filePath);
      result.creationTime = Math.floor(stat.mtimeMs / 1000);
    } catch (e) {
      result.creationTime = 0;
    }
  }

  return {
    characterName: result.characterName || "",
    characterLevel: result.characterLevel || 0,
    location: result.location || "",
    saveNumber: result.saveNumber || 0,
    creationTime: result.creationTime || 0,
    playTime: result.playTime || "",
    plugins: result.plugins || [],
    screenshotSize: result.screenshotSize || { width: 0, height: 0 },
    screenshot: result.screenshot || Buffer.alloc(0),
    fileName: path.basename(filePath),
  };
}
