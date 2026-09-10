import fs from "fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "path";

import getVortexPath from "@/util/getVortexPath";

export default async function generateVideoPreview(mp4Path: string, id: string) {
  const safeId = id.replace(/[<>:"/\\|?*]+/g, "_");
  const ok = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
  if (!ok) return undefined;
  const baseDir = path.join(getVortexPath("temp"), "videopreviews");
  await fs.mkdir(baseDir, { recursive: true });
  const outPath = path.join(baseDir, safeId + ".jpg");
  const alreadyGenerated = await fs
    .access(outPath)
    .then(() => true)
    .catch(() => false);
  if (alreadyGenerated) return outPath;
  return new Promise<string>((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      "00:00:01",
      "-i",
      mp4Path,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      "-vf",
      "scale=480:-1",
      "-f",
      "image2",
      outPath,
    ]);

    proc.on("exit", (code) => {
      if (code === 0) return resolve(outPath);
      window.api.log("warn", `ffmpeg failed: ${code} ${mp4Path}`);
      resolve(undefined);
    });
    proc.on("error", reject);
  });
}
