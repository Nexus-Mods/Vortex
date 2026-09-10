import fs from "fs/promises";
import path from "path";

import generateVideoPreview from "./generateVideoPreview";
import type { GameMediaItem, GameMediaSource } from "./mediaTypes";

export default async function collectMedia(
  sources: Record<string, GameMediaSource>,
  disabledSources: string[] | undefined,
): Promise<GameMediaItem[]> {
  let res: GameMediaItem[] = [];

  const activeSources = Object.entries(sources).filter(
    ([id, _]) => !disabledSources || !disabledSources.includes(id),
  );

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
          let thumbnailPath: string | undefined = undefined;
          if (path.extname(i.name) === ".mp4") {
            thumbnailPath = await generateVideoPreview(imagePath, `${sourceId}::${i.name}`);
          }
          return {
            id: `${sourceId}::${i.name}`,
            sourceId,
            name: i.name,
            path: imagePath,
            type: [".mp4", ".mpd"].includes(path.extname(i.name)) ? "video" : "image",
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            thumbnailPath,
          };
        }),
      );
      // console.log("Found images", mappedImages, source.name);
      res = res.concat(mappedImages);
    } catch (e) {
      if ((e as Error & { code?: string })?.code === "ENOENT") continue;
      else
        window.api.log(
          "warn",
          "Failed to parse media from source",
          JSON.stringify({ sourceId, source }),
        );
    }
  }

  return res.sort((a, b) => b.createdAt?.getTime() - a.createdAt?.getTime());
}
