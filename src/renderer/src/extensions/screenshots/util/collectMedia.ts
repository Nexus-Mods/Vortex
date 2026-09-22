import fs from "fs/promises";
import path from "path";

import { hasFfmpeg } from "./ffmpeg";
import generateVideoPreview from "./generateVideoPreview";
import type { GameMediaItem, GameMediaSource } from "./mediaTypes";
import { previewKey } from "./previewCache";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tga"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mkv", ".mpd"]);

export default async function collectMedia(
  sources: Record<string, GameMediaSource>,
  disabledSources: readonly string[] | undefined,
  flags: { showVideos?: boolean },
): Promise<GameMediaItem[]> {
  let res: GameMediaItem[] = [];

  const activeSources = Object.entries(sources).filter(
    ([id, _]) => !disabledSources || !disabledSources.includes(id),
  );

  for (const [sourceId, source] of activeSources) {
    if (source.discoverFn) {
      const media = await source.discoverFn(source.path);
      res = res.concat(media);
      continue;
    }

    try {
      await fs.stat(source.path);
      const files = await fs.readdir(source.path, { withFileTypes: true });
      let images = files.filter(
        (f) =>
          f.isFile() && [...IMAGE_EXT, ...VIDEO_EXT].includes(path.extname(f.name).toLowerCase()),
      );
      if (source.filterFn && typeof source.filterFn === "function")
        images = images.filter((i) => source.filterFn(i.name));
      const mappedImages: GameMediaItem[] = await Promise.all(
        images.map(async (i) => {
          const imagePath = path.join(source.path, i.name);
          const stats = await fs.stat(imagePath);
          const ext = path.extname(i.name).toLowerCase();
          let thumbnailPath: string | undefined = undefined;
          if (hasFfmpeg() && ext === ".mp4") {
            thumbnailPath = await generateVideoPreview(
              imagePath,
              previewKey(imagePath, stats.mtimeMs, stats.size),
            );
          }
          return {
            id: `${sourceId}::${i.name}`,
            sourceId,
            name: i.name,
            path: imagePath,
            type: VIDEO_EXT.has(ext) ? "video" : "image",
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            thumbnailPath,
          };
        }),
      );
      res = res.concat(mappedImages);
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT") continue;
      else
        window.api.log(
          "warn",
          "Failed to parse media from source",
          JSON.stringify({ sourceId, source }),
        );
    }
  }

  // If we're hiding videos, filter them out
  if (!flags.showVideos) res = res.filter((i) => i.type !== "video");

  return res.sort(sortMedia);
}

export const sortMedia = (a: GameMediaItem, b: GameMediaItem) =>
  (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
