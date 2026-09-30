/**
 * Generate a Vortex state fixture with a large collection already installed, so deploy and UI
 * behaviour on a big library can be tested without downloading or installing anything.
 *
 * Usage (from repo root):
 *   pnpm run fixture:collection -- [--out <dir>] [--game stardewvalley|skyrimse|fallout4]
 *     [--members 1000] [--phases 4] [--optional 0.1] [--library 0] [--overlap 0.1]
 *     [--seed 1] [--name "<collection name>"] [--auto-deploy] [--force]
 *
 * Then launch Vortex against it:
 *   pnpm run fixture:collection:launch -- [--out <dir>] [--debug] [--reset]
 *
 * See docs/collection-fixture.md for what the fixture contains and its caveats.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { buildFixture } from "./buildFixture";
import { GAME_IDS, isGameId } from "./games";
import {
  DEFAULT_COLLECTION_SHARE,
  ENABLED_RATIO,
  isTierId,
  TIER_IDS,
  type TierId,
  TIERS,
} from "./tiers";
import type { IFixture, IFixtureSpec } from "./types";

export const DEFAULT_OUT_DIR = path.join(os.tmpdir(), "vortex-collection-fixture");

const HELP = `Generate a Vortex fixture with a large collection already installed.

Size (see docs/collection-fixture.md for where the tiers come from):
  --tier <id>        ${TIER_IDS.map((id) => `${id} (${TIERS[id].total})`).join(", ")}
                     (default: typical, unless --members is given)
  --collection-share <0..1>
                     share of the tier's mods that belong to the collection; the rest are
                     installed outside it (default: ${DEFAULT_COLLECTION_SHARE})
  --members <n>      collection members; overrides the tier's split
  --library <n>      installed mods outside the collection; overrides the tier's split
  --enabled <n>      mods enabled in the profile (default: the tier's figure, or
                     ${Math.round(ENABLED_RATIO * 100)}% of installed mods without a tier)

Options:
  --out <dir>        output directory (default: ${DEFAULT_OUT_DIR})
  --game <id>        ${GAME_IDS.join(" | ")} (default: skyrimse)
  --phases <n>       install phases the members are spread over (default: 4)
  --optional <0..1>  share of members that are optional (default: 0.1)
  --overlap <0..1>   share of members sharing a file with others, for conflicts (default: 0.1)
  --seed <n>         random seed; the same spec and seed reproduce the fixture (default: 1)
  --name <text>      collection name (default: "Fixture Collection <game> <members>")
  --auto-deploy      leave auto-deploy on (default: off, so deploys are manual and timeable)
  --force            replace an existing output directory, including its user-data
  --help             this text
`;

interface IArgs {
  flags: Map<string, string | true>;
}

export function parseArgs(argv: string[]): IArgs {
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      throw new Error(`unexpected argument: ${arg}`);
    }
    const name = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags.set(name, next);
      i++;
    } else {
      flags.set(name, true);
    }
  }
  return { flags };
}

function numberFlag(args: IArgs, name: string, fallback: number): number {
  const value = args.flags.get(name);
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (value === true || Number.isNaN(parsed)) {
    throw new Error(`--${name} needs a number`);
  }
  return parsed;
}

interface ISize {
  members: number;
  library: number;
  enabled: number;
  tier?: TierId;
}

/**
 * A tier sets the total and enabled counts; --collection-share splits the total into members and
 * library. Explicit --members / --library / --enabled override the matching part. With no tier
 * and --members given, the size is exactly what was asked for.
 */
export function sizeFromArgs(args: IArgs): ISize {
  const tierFlag = args.flags.get("tier");
  let tierId: TierId | undefined;
  if (tierFlag !== undefined) {
    const value = String(tierFlag);
    if (!isTierId(value)) {
      throw new Error(`--tier must be one of ${TIER_IDS.join(", ")}`);
    }
    tierId = value;
  } else if (!args.flags.has("members")) {
    tierId = "typical";
  }

  if (tierId === undefined) {
    const members = numberFlag(args, "members", 0);
    const library = numberFlag(args, "library", 0);
    const fallback = Math.round((members + library) * ENABLED_RATIO);
    return { members, library, enabled: numberFlag(args, "enabled", fallback) };
  }

  const tier = TIERS[tierId];
  const share = numberFlag(args, "collection-share", DEFAULT_COLLECTION_SHARE);
  if (share <= 0 || share > 1) {
    throw new Error("--collection-share must be above 0 and at most 1");
  }
  const members = numberFlag(args, "members", Math.max(1, Math.round(tier.total * share)));
  const library = numberFlag(args, "library", Math.max(0, tier.total - members));
  return {
    members,
    library,
    enabled: numberFlag(args, "enabled", Math.min(tier.enabled, members + library)),
    tier: tierId,
  };
}

export function specFromArgs(args: IArgs): IFixtureSpec {
  const gameFlag = args.flags.get("game");
  const game = gameFlag === undefined ? "skyrimse" : String(gameFlag);
  if (!isGameId(game)) {
    throw new Error(`--game must be one of ${GAME_IDS.join(", ")}`);
  }
  const { members, library, enabled, tier } = sizeFromArgs(args);
  const outFlag = args.flags.get("out");
  const outDir = path.resolve(
    outFlag === undefined || outFlag === true ? DEFAULT_OUT_DIR : outFlag,
  );
  const nameFlag = args.flags.get("name");
  return {
    game,
    members,
    phases: numberFlag(args, "phases", 4),
    optionalRatio: numberFlag(args, "optional", 0.1),
    library,
    enabled,
    ...(tier !== undefined ? { tier } : {}),
    overlapRatio: numberFlag(args, "overlap", 0.1),
    seed: numberFlag(args, "seed", 1),
    outDir,
    collectionName:
      typeof nameFlag === "string" ? nameFlag : `Fixture Collection ${game} ${tier ?? members}`,
    autoDeploy: args.flags.get("auto-deploy") === true,
  };
}

export function writeFixture(fixture: IFixture): void {
  const { outDir } = fixture.paths;
  const root = path.parse(outDir).root;
  if (!fs.existsSync(root)) {
    throw new Error(`drive ${root} does not exist; choose an --out folder on a drive that does`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (const dir of fixture.directories) {
    fs.mkdirSync(path.join(outDir, dir), { recursive: true });
  }
  const seenDirs = new Set<string>();
  for (const file of fixture.files) {
    const target = path.join(outDir, file.path);
    const dir = path.dirname(target);
    if (!seenDirs.has(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      seenDirs.add(dir);
    }
    fs.writeFileSync(target, file.content);
  }
  fs.writeFileSync(fixture.paths.stateFile, JSON.stringify(fixture.state, null, 2));
  fs.writeFileSync(
    path.join(outDir, "fixture.json"),
    JSON.stringify({ spec: fixture.spec, paths: fixture.paths, summary: fixture.summary }, null, 2),
  );
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.has("help")) {
    process.stdout.write(HELP);
    return;
  }
  const spec = specFromArgs(args);

  if (fs.existsSync(spec.outDir) && fs.readdirSync(spec.outDir).length > 0) {
    if (args.flags.get("force") !== true) {
      throw new Error(`${spec.outDir} is not empty; pass --force to replace it`);
    }
    fs.rmSync(spec.outDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }

  const started = Date.now();
  const fixture = buildFixture(spec);
  writeFixture(fixture);
  const { summary } = fixture;

  process.stdout.write(
    [
      `Fixture written to ${spec.outDir} in ${Date.now() - started} ms`,
      `  game:        ${summary.game}`,
      `  collection:  ${summary.collectionId}`,
      `  members:     ${summary.members} (${summary.optional} optional, ${summary.phases} phases)`,
      `  library:     ${summary.library}`,
      `  profile:     ${summary.enabled} enabled, ${summary.disabled} disabled${summary.tier !== undefined ? ` (${summary.tier} tier)` : ""}`,
      `  rules:       ${summary.memberRules} load-order rules between members`,
      `  overlapping: ${summary.overlapping} members share files with others`,
      `  files:       ${summary.files} (${(summary.bytes / 1024 / 1024).toFixed(1)} MB)`,
      "",
      "Launch Vortex against it with:",
      `  pnpm run fixture:collection:launch -- --out "${spec.outDir}"`,
      "",
    ].join("\n"),
  );
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
