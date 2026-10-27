import { QualifiedPath } from "@vortex/shared/filesystem";

import { avg, q50 } from "../stats";
import type { IBenchmark, IBenchmarkContext } from "../types";

const VARIANTS = [
  { name: "no-status", includeStatus: false },
  { name: "status", includeStatus: true },
] as const;

async function countEntries(
  directory: string,
  includeStatus: boolean,
  signal: AbortSignal,
): Promise<number> {
  const iterator = await window.api.fs.enumerateDirectory(QualifiedPath.fromNative(directory), {
    recursive: true,
    types: "files",
    includeStatus,
  });

  let count = 0;
  try {
    for await (const _entry of iterator) {
      if (signal.aborted) break;
      count++;
    }
  } finally {
    // releases the main-side handle when we stopped early
    await iterator.return?.();
  }
  return count;
}

async function run({ options, signal, report }: IBenchmarkContext): Promise<void> {
  const directory = String(options.directory);
  const iterations = Number(options.iterations);
  const medians: Record<string, number> = {};

  for (const { name, includeStatus } of VARIANTS) {
    const durations: number[] = [];
    for (let iteration = 0; iteration < iterations; iteration++) {
      if (signal.aborted) return;

      const start = performance.now();
      const numFiles = await countEntries(directory, includeStatus, signal);
      const duration = performance.now() - start;
      if (signal.aborted) return;

      durations.push(duration);
      report({
        variant: name,
        iteration,
        duration,
        numFiles,
        durationPerEntry: duration / numFiles,
      });
    }

    medians[name] = q50(durations);
    report({ variant: name, avg: avg(durations), q50: medians[name], iterations });
  }

  const slow = Math.max(medians["status"], medians["no-status"]);
  const fast = Math.min(medians["status"], medians["no-status"]);
  report({
    comparison: "status vs no-status",
    overheadVsSlow: (slow - fast) / slow,
    overheadVsFast: (slow - fast) / fast,
  });
}

export const filesystemEnumerate: IBenchmark = {
  id: "filesystem-enumerate",
  name: "Filesystem: recursive enumeration over IPC",
  description:
    "Recursively enumerates and counts all files in a directory through window.api.fs, with and without includeStatus. Point it at a directory with many small files, like a pnpm store.",
  options: [
    { id: "directory", label: "Directory", type: "directory", default: "" },
    { id: "iterations", label: "Iterations", type: "number", default: 5 },
  ],
  run,
};
