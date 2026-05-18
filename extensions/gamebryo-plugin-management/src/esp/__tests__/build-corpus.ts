/**
 * Downloads real ESP/ESM/ESL plugin files from Nexus Mods and strips them
 * to header-only for use as a test corpus.
 *
 * Usage: npx tsx build-corpus.ts
 * Requires: NEXUS_API_KEY environment variable
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";

const API_KEY = process.env.NEXUS_API_KEY;
if (!API_KEY) {
  console.error("NEXUS_API_KEY environment variable required");
  process.exit(1);
}

const SEVEN_ZIP = "C:\\Program Files\\7-Zip\\7z.exe";
const CORPUS_DIR = path.join(__dirname, "corpus");
const PLUGIN_EXTENSIONS = [".esp", ".esm", ".esl"];
const MAX_ARCHIVE_SIZE_KB = 5000; // 5MB max archive size
const TARGET_PLUGINS_PER_GAME = 8;
const API_BASE = "https://api.nexusmods.com/v1";

// Rate limiting: Nexus API allows ~30 requests/second for premium
const RATE_LIMIT_MS = 200;

interface GameConfig {
  gameId: string;
  nexusDomain: string;
  notes: string;
}

const GAMES: GameConfig[] = [
  { gameId: "oblivion", nexusDomain: "oblivion", notes: "Oblivion-style format" },
  { gameId: "fallout3", nexusDomain: "fallout3", notes: "Original format" },
  { gameId: "falloutnv", nexusDomain: "newvegas", notes: "Original format" },
  { gameId: "skyrim", nexusDomain: "skyrim", notes: "Original format" },
  {
    gameId: "skyrimse",
    nexusDomain: "skyrimspecialedition",
    notes: "ESL support",
  },
  { gameId: "fallout4", nexusDomain: "fallout4", notes: "ESL support" },
  {
    gameId: "starfield",
    nexusDomain: "starfield",
    notes: "ESL + medium masters + blueprints",
  },
];

interface NexusFile {
  file_id: number;
  name: string;
  file_name: string;
  size_kb: number;
  category_name: string;
  content_preview_link: string;
}

interface ManifestEntry {
  file: string;
  gameId: string;
  nexusDomain: string;
  sourceModId: number;
  sourceFileId: number;
  sourceFileName: string;
  originalSize: number;
  strippedSize: number;
  extension: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function nexusGet<T>(endpoint: string): Promise<T> {
  await sleep(RATE_LIMIT_MS);
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    const req = https.get(
      url,
      { headers: { apikey: API_KEY!, "User-Agent": "Vortex2-CorpusBuilder" } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`${res.statusCode} ${res.statusMessage}: ${url}\n${data}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error for ${url}: ${e}`));
          }
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  await sleep(100);
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : require("http");
    protocol
      .get(url, { headers: { "User-Agent": "Vortex2-CorpusBuilder" } }, (res: any) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error for ${url}: ${e}`));
          }
        });
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : require("http");
    const file = fs.createWriteStream(dest);
    protocol
      .get(url, { headers: { "User-Agent": "Vortex2-CorpusBuilder" } }, (res: any) => {
        // Follow redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlinkSync(dest);
          downloadFile(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`Download failed: ${res.statusCode} ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", (err: Error) => {
          fs.unlinkSync(dest);
          reject(err);
        });
      })
      .on("error", (err: Error) => {
        file.close();
        try {
          fs.unlinkSync(dest);
        } catch {}
        reject(err);
      });
  });
}

interface ContentNode {
  path?: string;
  size?: number | string;
  children?: ContentNode[];
}

function findPluginFiles(node: ContentNode, prefix: string = ""): { path: string; size: number }[] {
  const results: { path: string; size: number }[] = [];
  const currentPath = prefix ? `${prefix}/${node.path || ""}` : node.path || "";

  if (node.path && PLUGIN_EXTENSIONS.some((ext) => node.path!.toLowerCase().endsWith(ext))) {
    const sizeNum = typeof node.size === "string" ? parseFloat(node.size) : node.size || 0;
    results.push({ path: currentPath, size: sizeNum });
  }

  if (node.children) {
    for (const child of node.children) {
      results.push(...findPluginFiles(child, currentPath));
    }
  }

  return results;
}

/**
 * Strip an ESP/ESM/ESL file to just its TES4 header record.
 * Format: 4 bytes type + 4 bytes dataSize + 4 bytes flags + 4 bytes id + 4 bytes revision
 *         [+ optional 4 bytes version info] + dataSize bytes of subrecord data
 */
function stripToHeader(filePath: string): number {
  const buf = fs.readFileSync(filePath);

  if (buf.length < 24) {
    console.warn(`  File too small to be valid: ${filePath} (${buf.length} bytes)`);
    return buf.length;
  }

  const type = buf.toString("ascii", 0, 4);
  if (type !== "TES4") {
    console.warn(`  Not a valid plugin file (magic: ${type}): ${filePath}`);
    return buf.length;
  }

  const dataSize = buf.readUInt32LE(4);
  const headerSize = 20; // type(4) + dataSize(4) + flags(4) + id(4) + revision(4)

  // Check if this is Oblivion-style (no version info between header and subrecords)
  let versionInfoSize = 4; // post-Oblivion has 4 bytes of version info
  if (buf.length >= headerSize + 4) {
    const nextFour = buf.toString("ascii", headerSize, headerSize + 4);
    if (nextFour === "HEDR") {
      versionInfoSize = 0; // Oblivion style — HEDR follows immediately
    }
  }

  const totalRecordSize = headerSize + versionInfoSize + dataSize;
  const truncateAt = Math.min(totalRecordSize, buf.length);

  fs.writeFileSync(filePath, buf.subarray(0, truncateAt));
  return truncateAt;
}

async function collectPluginsForGame(game: GameConfig): Promise<ManifestEntry[]> {
  const gameDir = path.join(CORPUS_DIR, game.gameId);
  fs.mkdirSync(gameDir, { recursive: true });

  console.log(`\n=== ${game.gameId} (${game.nexusDomain}) ===`);
  console.log(`  Notes: ${game.notes}`);

  // Get recently updated mods
  const updatedMods = await nexusGet<{ mod_id: number }[]>(
    `/games/${game.nexusDomain}/mods/updated.json?period=1m`,
  );
  console.log(`  Found ${updatedMods.length} recently updated mods`);

  const collected: ManifestEntry[] = [];
  const seenExtensions = new Set<string>();
  const tmpDir = path.join(CORPUS_DIR, "_tmp");
  fs.mkdirSync(tmpDir, { recursive: true });

  for (const mod of updatedMods) {
    if (collected.length >= TARGET_PLUGINS_PER_GAME) break;

    try {
      // Get file list for this mod
      const filesResp = await nexusGet<{ files: NexusFile[] }>(
        `/games/${game.nexusDomain}/mods/${mod.mod_id}/files.json`,
      );

      for (const file of filesResp.files) {
        if (collected.length >= TARGET_PLUGINS_PER_GAME) break;
        if (file.size_kb > MAX_ARCHIVE_SIZE_KB) continue;
        if (file.category_name === "DELETED" || file.category_name === "OLD_VERSION") continue;

        // Check archive contents via content preview
        if (!file.content_preview_link) continue;

        let contentTree: ContentNode;
        try {
          contentTree = await fetchJson<ContentNode>(file.content_preview_link);
        } catch {
          continue;
        }

        const pluginFiles = findPluginFiles(contentTree);
        if (pluginFiles.length === 0) continue;

        // Prefer files with extensions we haven't collected yet
        const sortedPlugins = [...pluginFiles].sort((a, b) => {
          const extA = path.extname(a.path).toLowerCase();
          const extB = path.extname(b.path).toLowerCase();
          const aNew = seenExtensions.has(extA) ? 1 : 0;
          const bNew = seenExtensions.has(extB) ? 1 : 0;
          return aNew - bNew;
        });

        // Download the archive
        let downloadLinks;
        try {
          downloadLinks = await nexusGet<{ URI: string }[]>(
            `/games/${game.nexusDomain}/mods/${mod.mod_id}/files/${file.file_id}/download_link.json`,
          );
        } catch (e: any) {
          // 403 = premium-only download, skip
          if (e.message?.includes("403")) continue;
          throw e;
        }

        if (!downloadLinks?.[0]?.URI) continue;

        const archivePath = path.join(tmpDir, file.file_name);
        console.log(`  Downloading: ${file.file_name} (${file.size_kb}KB)`);

        try {
          await downloadFile(downloadLinks[0].URI, archivePath);
        } catch (e: any) {
          console.warn(`  Download failed: ${e.message}`);
          continue;
        }

        // Extract plugin files from archive
        for (const plugin of sortedPlugins) {
          if (collected.length >= TARGET_PLUGINS_PER_GAME) break;

          const extractDir = path.join(tmpDir, "extract");
          fs.mkdirSync(extractDir, { recursive: true });

          try {
            execSync(`"${SEVEN_ZIP}" e "${archivePath}" -o"${extractDir}" "${plugin.path}" -y -r`, {
              stdio: "pipe",
            });
          } catch {
            console.warn(`  Failed to extract: ${plugin.path}`);
            continue;
          }

          // Find the extracted file (7z flattens paths with -e)
          const baseName = path.basename(plugin.path);
          const extractedPath = path.join(extractDir, baseName);

          if (!fs.existsSync(extractedPath)) {
            // Try case-insensitive search
            const files = fs.readdirSync(extractDir);
            const match = files.find((f) => f.toLowerCase() === baseName.toLowerCase());
            if (!match) {
              console.warn(`  Extracted file not found: ${baseName}`);
              // Clean up extract dir
              fs.rmSync(extractDir, { recursive: true, force: true });
              continue;
            }
            // Use the matched name
            const matchedPath = path.join(extractDir, match);
            const ext = path.extname(baseName).toLowerCase();
            const destName = `${game.gameId}_mod${mod.mod_id}_${file.file_id}${ext}`;
            const destPath = path.join(gameDir, destName);

            fs.copyFileSync(matchedPath, destPath);
            const originalSize = fs.statSync(destPath).size;
            const strippedSize = stripToHeader(destPath);

            seenExtensions.add(ext);
            collected.push({
              file: `${game.gameId}/${destName}`,
              gameId: game.gameId,
              nexusDomain: game.nexusDomain,
              sourceModId: mod.mod_id,
              sourceFileId: file.file_id,
              sourceFileName: file.file_name,
              originalSize,
              strippedSize,
              extension: ext,
            });

            console.log(`  Collected: ${destName} (${originalSize} → ${strippedSize} bytes)`);

            fs.rmSync(extractDir, { recursive: true, force: true });
            continue;
          }

          const ext = path.extname(baseName).toLowerCase();
          const destName = `${game.gameId}_mod${mod.mod_id}_${file.file_id}${ext}`;
          const destPath = path.join(gameDir, destName);

          fs.copyFileSync(extractedPath, destPath);
          const originalSize = fs.statSync(destPath).size;
          const strippedSize = stripToHeader(destPath);

          seenExtensions.add(ext);
          collected.push({
            file: `${game.gameId}/${destName}`,
            gameId: game.gameId,
            nexusDomain: game.nexusDomain,
            sourceModId: mod.mod_id,
            sourceFileId: file.file_id,
            sourceFileName: file.file_name,
            originalSize,
            strippedSize,
            extension: ext,
          });

          console.log(`  Collected: ${destName} (${originalSize} → ${strippedSize} bytes)`);

          // Clean up extract dir
          fs.rmSync(extractDir, { recursive: true, force: true });
        }

        // Clean up archive
        try {
          fs.unlinkSync(archivePath);
        } catch {}
      }
    } catch (e: any) {
      console.warn(`  Error processing mod ${mod.mod_id}: ${e.message}`);
      continue;
    }
  }

  console.log(
    `  Total collected: ${collected.length} (extensions: ${[...seenExtensions].join(", ")})`,
  );
  return collected;
}

async function main() {
  console.log("Building ESP/ESM/ESL test corpus from Nexus Mods");
  console.log(`Output directory: ${CORPUS_DIR}`);

  const manifest: ManifestEntry[] = [];

  for (const game of GAMES) {
    try {
      const entries = await collectPluginsForGame(game);
      manifest.push(...entries);
    } catch (e: any) {
      console.error(`Failed to process ${game.gameId}: ${e.message}`);
    }
  }

  // Clean up tmp directory
  const tmpDir = path.join(CORPUS_DIR, "_tmp");
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // Write manifest
  const manifestPath = path.join(CORPUS_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\n=== Summary ===`);
  console.log(`Total files: ${manifest.length}`);
  for (const game of GAMES) {
    const count = manifest.filter((e) => e.gameId === game.gameId).length;
    const exts = [
      ...new Set(manifest.filter((e) => e.gameId === game.gameId).map((e) => e.extension)),
    ];
    console.log(`  ${game.gameId}: ${count} files (${exts.join(", ")})`);
  }
  console.log(`Manifest written to: ${manifestPath}`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
