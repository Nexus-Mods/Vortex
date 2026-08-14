import fs from "fs/promises";
import path from "path";

import type { GameMediaItem, GameMediaSource } from "./mediaTypes";

export default async function collectImages(
  sources: Record<string, GameMediaSource>,
): Promise<GameMediaItem[]> {
  let res: GameMediaItem[] = [];

  const activeSources = Object.entries(sources).filter(([_, s]) => s.active === true);

  for (const [sourceId, source] of activeSources) {
    // console.log("Collecting images from", sourceId, source);
    if (source.discoverFn) {
      const media = await source.discoverFn(source.path);
      // console.log("Collected media", media);
      res = res.concat(media);
      continue;
    }

    try {
      await fs.stat(source.path);
      const files = await fs.readdir(source.path, { withFileTypes: true });
      let images = files.filter(
        (f) =>
          f.isFile() && [".jpg", ".png", ".gif", ".bmp", ".mp4"].includes(path.extname(f.name)),
      );
      if (source.filterFn && typeof source.filterFn === "function")
        images = images.filter((i) => source.filterFn(i.name));
      const mappedImages: GameMediaItem[] = await Promise.all(
        images.map(async (i) => {
          const imagePath = path.join(source.path, i.name);
          const stats = await fs.stat(imagePath);
          return {
            id: `${sourceId}::${i.name}`,
            sourceId,
            name: i.name,
            path: imagePath,
            type: path.extname(i.name) === ".mp4" ? "video" : "image",
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
          };
        }),
      );
      // console.log("Found images", mappedImages, source.name);
      res = res.concat(mappedImages);
    } catch (e) {
      if ((e as Error & { code?: string })?.code === "ENOENT") continue;
      //   else log("warn", "Failed to parse media from source", { sourceId, source });
    }
  }

  return res;
}
