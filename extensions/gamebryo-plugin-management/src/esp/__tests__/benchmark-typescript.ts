/**
 * Benchmarks the TypeScript ESP parser against the test corpus.
 * Compares results with the C++ esptk baseline.
 *
 * Usage: npx tsx benchmark-typescript.ts
 */

import * as fs from "fs";
import * as path from "path";
import { ESPFile } from "../ESPFile";

const CORPUS_DIR = path.join(__dirname, "corpus");
const ITERATIONS = 10_000;

interface ManifestEntry {
  file: string;
  gameId: string;
}

interface BenchmarkResult {
  file: string;
  gameId: string;
  iterations: number;
  totalMs: number;
  meanUs: number;
  p50Us: number;
  p99Us: number;
  minUs: number;
  maxUs: number;
}

async function benchmarkFile(filePath: string, gameId: string): Promise<BenchmarkResult> {
  const timings: number[] = [];

  // Warm up
  for (let i = 0; i < 100; i++) {
    try {
      await ESPFile.open(filePath, gameId);
    } catch {}
  }

  // Benchmark
  for (let i = 0; i < ITERATIONS; i++) {
    const start = process.hrtime.bigint();
    try {
      await ESPFile.open(filePath, gameId);
    } catch {}
    const end = process.hrtime.bigint();
    timings.push(Number(end - start) / 1000); // ns → μs
  }

  timings.sort((a, b) => a - b);
  const totalMs = timings.reduce((s, t) => s + t, 0) / 1000;

  const relPath = path.relative(CORPUS_DIR, filePath).replace(/\\/g, "/");
  return {
    file: relPath,
    gameId,
    iterations: ITERATIONS,
    totalMs: Math.round(totalMs * 100) / 100,
    meanUs: Math.round((totalMs * 1000 / ITERATIONS) * 100) / 100,
    p50Us: Math.round(timings[Math.floor(ITERATIONS * 0.5)] * 100) / 100,
    p99Us: Math.round(timings[Math.floor(ITERATIONS * 0.99)] * 100) / 100,
    minUs: Math.round(timings[0] * 100) / 100,
    maxUs: Math.round(timings[timings.length - 1] * 100) / 100,
  };
}

async function main() {
  const manifestPath = path.join(CORPUS_DIR, "manifest.json");
  const manifest: ManifestEntry[] = JSON.parse(
    fs.readFileSync(manifestPath, "utf-8"),
  );

  // Load baseline for comparison
  const baselinePath = path.join(CORPUS_DIR, "benchmark-baseline.json");
  const baseline: BenchmarkResult[] = fs.existsSync(baselinePath)
    ? JSON.parse(fs.readFileSync(baselinePath, "utf-8"))
    : [];
  const baselineMap = new Map(baseline.map((b) => [b.file, b]));

  console.log(
    `Benchmarking TypeScript ESP parser against ${manifest.length} corpus files`,
  );
  console.log(`Iterations per file: ${ITERATIONS}\n`);
  console.log(
    `${"File".padEnd(55)} ${"TS mean".padStart(10)} ${"C++ mean".padStart(10)} ${"Ratio".padStart(8)}`,
  );
  console.log("-".repeat(85));

  const tsResults: BenchmarkResult[] = [];

  for (const entry of manifest) {
    const filePath = path.join(CORPUS_DIR, entry.file);
    if (!fs.existsSync(filePath)) continue;

    const result = await benchmarkFile(filePath, entry.gameId);
    tsResults.push(result);

    const bl = baselineMap.get(result.file);
    const ratio = bl ? (result.meanUs / bl.meanUs).toFixed(2) + "x" : "N/A";
    const blMean = bl ? `${bl.meanUs}μs` : "N/A";

    console.log(
      `${result.file.padEnd(55)} ${(result.meanUs + "μs").padStart(10)} ${blMean.padStart(10)} ${ratio.padStart(8)}`,
    );
  }

  // Write results
  const resultPath = path.join(CORPUS_DIR, "benchmark-typescript.json");
  fs.writeFileSync(resultPath, JSON.stringify(tsResults, null, 2));

  // Aggregates
  const tsMean = tsResults.reduce((s, r) => s + r.meanUs, 0) / tsResults.length;
  const tsP50 = tsResults.reduce((s, r) => s + r.p50Us, 0) / tsResults.length;
  const tsP99 = tsResults.reduce((s, r) => s + r.p99Us, 0) / tsResults.length;

  const blAvg = baseline.length > 0
    ? baseline.reduce((s, b) => s + b.meanUs, 0) / baseline.length
    : 0;
  const blP50 = baseline.length > 0
    ? baseline.reduce((s, b) => s + b.p50Us, 0) / baseline.length
    : 0;
  const blP99 = baseline.length > 0
    ? baseline.reduce((s, b) => s + b.p99Us, 0) / baseline.length
    : 0;

  console.log("\n=== Aggregate Comparison ===");
  console.log(
    `${"".padEnd(20)} ${"TypeScript".padStart(12)} ${"C++ esptk".padStart(12)} ${"Ratio".padStart(8)}`,
  );
  console.log("-".repeat(54));
  console.log(
    `${"Avg mean".padEnd(20)} ${(tsMean.toFixed(2) + "μs").padStart(12)} ${(blAvg.toFixed(2) + "μs").padStart(12)} ${(tsMean / blAvg).toFixed(2).padStart(7)}x`,
  );
  console.log(
    `${"Avg p50".padEnd(20)} ${(tsP50.toFixed(2) + "μs").padStart(12)} ${(blP50.toFixed(2) + "μs").padStart(12)} ${(tsP50 / blP50).toFixed(2).padStart(7)}x`,
  );
  console.log(
    `${"Avg p99".padEnd(20)} ${(tsP99.toFixed(2) + "μs").padStart(12)} ${(blP99.toFixed(2) + "μs").padStart(12)} ${(tsP99 / blP99).toFixed(2).padStart(7)}x`,
  );

  // Parallel throughput benchmark: parse all corpus files concurrently
  // This measures what the extension could do with Promise.all — something
  // the sync C++ API could never do.
  const allFiles = manifest
    .map((e) => ({ path: path.join(CORPUS_DIR, e.file), gameId: e.gameId }))
    .filter((e) => fs.existsSync(e.path));

  const PARALLEL_ITERS = 1000;

  // Warm up
  for (let i = 0; i < 10; i++) {
    await Promise.all(allFiles.map((f) => ESPFile.open(f.path, f.gameId).catch(() => {})));
  }

  // Sequential async (how the current code works with await in a loop)
  const seqTimings: number[] = [];
  for (let i = 0; i < PARALLEL_ITERS; i++) {
    const start = process.hrtime.bigint();
    for (const f of allFiles) {
      try { await ESPFile.open(f.path, f.gameId); } catch {}
    }
    const end = process.hrtime.bigint();
    seqTimings.push(Number(end - start) / 1000);
  }
  seqTimings.sort((a, b) => a - b);

  // Parallel async (Promise.all)
  const parTimings: number[] = [];
  for (let i = 0; i < PARALLEL_ITERS; i++) {
    const start = process.hrtime.bigint();
    await Promise.all(allFiles.map((f) => ESPFile.open(f.path, f.gameId).catch(() => {})));
    const end = process.hrtime.bigint();
    parTimings.push(Number(end - start) / 1000);
  }
  parTimings.sort((a, b) => a - b);

  // C++ sync baseline: sum of per-file means × file count
  const cppTotalUs = baseline.reduce((s, b) => s + b.meanUs, 0);

  const seqP50 = seqTimings[Math.floor(PARALLEL_ITERS * 0.5)];
  const parP50 = parTimings[Math.floor(PARALLEL_ITERS * 0.5)];

  console.log(`\n=== Batch Parse: All ${allFiles.length} Files ===`);
  console.log(
    `${"".padEnd(25)} ${"p50 (μs)".padStart(12)} ${"p50 (ms)".padStart(10)} ${"vs C++ sync".padStart(12)}`,
  );
  console.log("-".repeat(61));
  console.log(
    `${"C++ sync (sequential)".padEnd(25)} ${cppTotalUs.toFixed(0).padStart(12)} ${(cppTotalUs / 1000).toFixed(2).padStart(9)}ms ${"1.00x".padStart(12)}`,
  );
  console.log(
    `${"TS async (sequential)".padEnd(25)} ${seqP50.toFixed(0).padStart(12)} ${(seqP50 / 1000).toFixed(2).padStart(9)}ms ${(seqP50 / cppTotalUs).toFixed(2).padStart(11)}x`,
  );
  console.log(
    `${"TS async (Promise.all)".padEnd(25)} ${parP50.toFixed(0).padStart(12)} ${(parP50 / 1000).toFixed(2).padStart(9)}ms ${(parP50 / cppTotalUs).toFixed(2).padStart(11)}x`,
  );
}

main();
