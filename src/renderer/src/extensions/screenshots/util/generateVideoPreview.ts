import fs from "fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "path";

import { previewDir } from "./previewCache";

let ffmpegAvailable: boolean | undefined;

export const hasFfmpeg = () =>
  (ffmpegAvailable ??= spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0);

export default async function generateVideoPreview(
  mp4Path: string,
  id: string,
): Promise<string | undefined> {
  if (!hasFfmpeg()) return undefined;
  const baseDir = previewDir();
  await fs.mkdir(baseDir, { recursive: true });
  const outPath = path.join(baseDir, id + ".jpg");
  const alreadyGenerated = await fs
    .access(outPath)
    .then(() => true)
    .catch(() => false);
  if (alreadyGenerated) {
    // Set the dates on the image to show it's in use.
    void fs.utimes(outPath, new Date(), new Date()).catch(() => undefined);
    return outPath;
  }
  const tmpPath = `${outPath}.${process.pid}.tmp`;
  return new Promise<string | undefined>((resolve) => {
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
      tmpPath,
    ]);

    proc.on("exit", (code) => {
      if (code !== 0) {
        window.api.log("warn", `ffmpeg failed: ${code} ${mp4Path}`);
        return resolve(undefined);
      }
      fs.rename(tmpPath, outPath)
        .then(() => resolve(outPath))
        .catch(() => resolve(undefined));
    });
    proc.on("error", () => resolve(undefined));
  });
}
