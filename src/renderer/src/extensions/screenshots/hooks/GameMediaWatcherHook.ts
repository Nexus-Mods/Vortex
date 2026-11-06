import fs from "fs";

import { useEffect } from "react";

import Debouncer from "@/util/Debouncer";

import type { ResolvedGameMediaSource } from "../util/mediaTypes";

export default function useGameMediaWatcher(
  sources: Record<string, ResolvedGameMediaSource>,
  disabled: readonly string[],
  onSourceChanged: (sourceId: string) => Promise<void>,
) {
  useEffect(() => {
    const watchers: fs.FSWatcher[] = [];
    const debouncers = new Map<string, Debouncer>();

    for (const [id, source] of Object.entries(sources)) {
      if (disabled.includes(id)) continue;
      const debouncer = new Debouncer(async () => onSourceChanged(id), 1000);
      debouncers.set(id, debouncer);

      try {
        watchers.push(fs.watch(source.path, () => debouncer.schedule()));
      } catch (err) {
        // folder gone, removable drive, permissions — skip this source
        window.api.log("debug", "could not watch media source", JSON.stringify({ id, err }));
      }
    }

    return () => {
      watchers.forEach((w) => w.close());
      debouncers.forEach((d) => d.clear());
    };
  }, [sources, disabled, onSourceChanged]);
}
