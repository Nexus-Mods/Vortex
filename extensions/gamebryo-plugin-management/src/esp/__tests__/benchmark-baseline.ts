/**
 * Benchmarks the existing C++ esptk parser against the test corpus.
 * Outputs:
 *   corpus/expected-output.json  — parsed field values (reused as test expectations)
 *   corpus/benchmark-baseline.json — timing data
 *
 * Usage: npx tsx benchmark-baseline.ts
 */

import * as fs from "fs";
import * as path from "path";

// The native addon (only needed when esptk is installed for baseline comparison)
// @ts-expect-error esptk is removed from production dependencies
import ESPFile from "esptk";

const CORPUS_DIR = path.join(__dirname, "corpus");
const ITERATIONS = 10_000;

interface ManifestEntry {
  file: string;
  gameId: string;
  extension: string;
}

interface ParsedOutput {
  file: string;
  gameId: string;
  isMaster: boolean;
  isLight: boolean;
  isMedium: boolean;
  isBlueprint: boolean;
  isDummy: boolean;
  author: string;
  description: string;
  masterList: string[];
  revision: number;
  parseError?: string;
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

function gameIdToGameMode(gameId: string): string {
  // The esptk constructor takes a gameMode string that maps to the
  // game support configuration. For most games it's the game ID itself.
  return gameId;
}

function parseFile(filePath: string, gameId: string): ParsedOutput {
  const gameMode = gameIdToGameMode(gameId);
  try {
    const esp = new ESPFile(filePath, gameMode);
    return {
      file: path.relative(CORPUS_DIR, filePath).replace(/\\/g, "/"),
      gameId,
      isMaster: esp.isMaster,
      isLight: esp.isLight,
      isMedium: esp.isMedium,
      isBlueprint: esp.isBlueprint,
      isDummy: esp.isDummy,
      author: esp.author,
      description: esp.description,
      masterList: [...esp.masterList],
      revision: esp.revision,
    };
  } catch (e: any) {
    return {
      file: path.relative(CORPUS_DIR, filePath).replace(/\\/g, "/"),
      gameId,
      isMaster: false,
      isLight: false,
      isMedium: false,
      isBlueprint: false,
      isDummy: false,
      author: "",
      description: "",
      masterList: [],
      revision: 0,
      parseError: e.message,
    };
  }
}

function benchmarkFile(
  filePath: string,
  gameId: string,
): BenchmarkResult {
  const gameMode = gameIdToGameMode(gameId);
  const timings: number[] = [];

  // Warm up
  for (let i = 0; i < 100; i++) {
    try {
      new ESPFile(filePath, gameMode);
    } catch {}
  }

  // Benchmark
  for (let i = 0; i < ITERATIONS; i++) {
    const start = process.hrtime.bigint();
    try {
      new ESPFile(filePath, gameMode);
    } catch {}
    const end = process.hrtime.bigint();
    timings.push(Number(end - start) / 1000); // nanoseconds → microseconds
  }

  timings.sort((a, b) => a - b);
  const totalMs = timings.reduce((s, t) => s + t, 0) / 1000; // us → ms

  const relPath = path.relative(CORPUS_DIR, filePath).replace(/\\/g, "/");
  return {
    file: relPath,
    gameId,
    iterations: ITERATIONS,
    totalMs: Math.round(totalMs * 100) / 100,
    meanUs: Math.round((totalMs * 1000) / ITERATIONS * 100) / 100,
    p50Us: Math.round(timings[Math.floor(ITERATIONS * 0.5)] * 100) / 100,
    p99Us: Math.round(timings[Math.floor(ITERATIONS * 0.99)] * 100) / 100,
    minUs: Math.round(timings[0] * 100) / 100,
    maxUs: Math.round(timings[timings.length - 1] * 100) / 100,
  };
}

function main() {
  const manifestPath = path.join(CORPUS_DIR, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("Corpus manifest not found. Run build-corpus.ts first.");
    process.exit(1);
  }

  const manifest: ManifestEntry[] = JSON.parse(
    fs.readFileSync(manifestPath, "utf-8"),
  );

  console.log(`Benchmarking C++ esptk against ${manifest.length} corpus files`);
  console.log(`Iterations per file: ${ITERATIONS}\n`);

  const parsedOutputs: ParsedOutput[] = [];
  const benchmarkResults: BenchmarkResult[] = [];

  for (const entry of manifest) {
    const filePath = path.join(CORPUS_DIR, entry.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  Missing: ${entry.file}`);
      continue;
    }

    // Parse to get expected output
    const parsed = parseFile(filePath, entry.gameId);
    parsedOutputs.push(parsed);

    if (parsed.parseError) {
      console.log(
        `  ${entry.file}: PARSE ERROR — ${parsed.parseError}`,
      );
      continue;
    }

    console.log(
      `  ${entry.file}: master=${parsed.isMaster} light=${parsed.isLight} ` +
        `medium=${parsed.isMedium} blueprint=${parsed.isBlueprint} ` +
        `dummy=${parsed.isDummy} masters=${parsed.masterList.length} ` +
        `author="${parsed.author.slice(0, 30)}" rev=${parsed.revision}`,
    );

    // Benchmark
    const bench = benchmarkFile(filePath, entry.gameId);
    benchmarkResults.push(bench);
    console.log(
      `    → mean=${bench.meanUs}μs p50=${bench.p50Us}μs p99=${bench.p99Us}μs`,
    );
  }

  // Write expected output
  const expectedPath = path.join(CORPUS_DIR, "expected-output.json");
  fs.writeFileSync(expectedPath, JSON.stringify(parsedOutputs, null, 2));
  console.log(`\nExpected output written to: ${expectedPath}`);

  // Write benchmark results
  const benchPath = path.join(CORPUS_DIR, "benchmark-baseline.json");
  fs.writeFileSync(benchPath, JSON.stringify(benchmarkResults, null, 2));
  console.log(`Benchmark baseline written to: ${benchPath}`);

  // Summary
  const successful = benchmarkResults.filter((b) => b.totalMs > 0);
  if (successful.length > 0) {
    const avgMean =
      successful.reduce((s, b) => s + b.meanUs, 0) / successful.length;
    const avgP50 =
      successful.reduce((s, b) => s + b.p50Us, 0) / successful.length;
    const avgP99 =
      successful.reduce((s, b) => s + b.p99Us, 0) / successful.length;

    console.log(`\n=== Aggregate (C++ esptk) ===`);
    console.log(`  Files benchmarked: ${successful.length}`);
    console.log(`  Avg mean: ${Math.round(avgMean * 100) / 100}μs`);
    console.log(`  Avg p50:  ${Math.round(avgP50 * 100) / 100}μs`);
    console.log(`  Avg p99:  ${Math.round(avgP99 * 100) / 100}μs`);
  }

  const errors = parsedOutputs.filter((p) => p.parseError);
  if (errors.length > 0) {
    console.log(`\n=== Parse Errors ===`);
    for (const e of errors) {
      console.log(`  ${e.file}: ${e.parseError}`);
    }
  }
}

main();
