import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import * as https from "node:https";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const BUILDS_PAGE_URL = "https://builds.bepinex.dev/projects/bepinex_be";
const ARTIFACT_LINK =
  /<a\b[^>]*href="([^"]+)"[^>]*>\s*(BepInEx-Unity\.IL2CPP-win-x64-[^<]+?\.zip)\s*<\/a>/i;

export interface IBepInExBuildArtifact {
  archiveName: string;
  downloadUrl: string;
}

export function resolveLatestBepInExBuild(html: string): IBepInExBuildArtifact {
  // The builds page lists artifacts newest-first.
  const match = ARTIFACT_LINK.exec(html);
  if (match === null) {
    throw new Error("No Windows x64 IL2CPP BepInEx build was found");
  }

  const downloadUrl = new URL(match[1], BUILDS_PAGE_URL);
  if (downloadUrl.protocol !== "https:") {
    throw new Error("BepInEx build download URL must use HTTPS");
  }

  return {
    archiveName: match[2],
    downloadUrl: downloadUrl.href,
  };
}

async function getResponse(url: URL, redirects = 0): Promise<IncomingMessage> {
  if (url.protocol !== "https:") {
    throw new Error("BepInEx build URLs must use HTTPS");
  }

  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400 && response.headers.location !== undefined) {
        response.resume();
        if (redirects >= 5) {
          reject(new Error("Too many redirects while downloading BepInEx"));
          return;
        }
        getResponse(new URL(response.headers.location, url), redirects + 1).then(resolve, reject);
        return;
      }

      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`BepInEx build request failed with HTTP ${status}`));
        return;
      }

      resolve(response);
    });
    request.on("error", reject);
  });
}

async function readText(url: URL): Promise<string> {
  const response = await getResponse(url);
  const chunks: Buffer[] = [];
  for await (const chunk of response) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function fetchLatestBepInExBuild(): Promise<IBepInExBuildArtifact> {
  const html = await readText(new URL(BUILDS_PAGE_URL));
  return resolveLatestBepInExBuild(html);
}

export async function downloadBepInExBuild(
  artifact: IBepInExBuildArtifact,
  destinationDir: string,
): Promise<string> {
  const destinationPath = path.join(destinationDir, artifact.archiveName);
  try {
    const response = await getResponse(new URL(artifact.downloadUrl));
    await pipeline(response, createWriteStream(destinationPath));
    return destinationPath;
  } catch (err) {
    await unlink(destinationPath).catch(() => undefined);
    throw err;
  }
}
