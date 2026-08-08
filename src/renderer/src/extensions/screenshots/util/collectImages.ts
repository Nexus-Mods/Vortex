import fs from "fs/promises";
import path from "path";

import type { MediaItem, MediaSource } from "./mediaTypes";

export default async function collectImages(
  sources: Record<string, MediaSource>,
): Promise<MediaItem[]> {
  let res: MediaItem[] = [];

  const activeSources = Object.entries(sources).filter(([_, s]) => s.active === true);

  for (const [sourceId, source] of activeSources) {
    console.log("Collecting images from", sourceId, source);
    if (source.discoverFn) {
      const media = await source.discoverFn(source.path);
      console.log("Collected media", media);
      res = res.concat(media);
      continue;
    }

    try {
      await fs.stat(source.path);
      const files = await fs.readdir(source.path);
      let images = files.filter((f) => [".jpg", ".png", ".gif", ".bmp"].includes(path.extname(f)));
      if (source.filterFn && typeof source.filterFn === "function")
        images = images.filter(source.filterFn);
      const mappedImages: MediaItem[] = images.map((i) => ({
        id: `${sourceId}::${i}`,
        sourceId,
        name: i,
        path: path.join(source.path, i),
        type: path.extname(i) === ".mp4" ? "video" : "image",
      }));
      console.log("Found images", mappedImages, source.name);
      res = res.concat(mappedImages);
    } catch (e) {
      if ((e as Error & { code?: string })?.code === "ENOENT") continue;
      //   else log("warn", "Failed to parse media from source", { sourceId, source });
    }
  }

  return res;
}
