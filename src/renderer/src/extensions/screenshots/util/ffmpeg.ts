import { spawnSync } from "child_process";

let available: boolean | undefined;

export const hasFfmpeg = (): boolean =>
  (available ??= spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0);
