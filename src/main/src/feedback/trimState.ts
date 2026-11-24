type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The object at `path` under `root`, or undefined where the state has another shape there. */
function objectAt(root: unknown, ...path: string[]): JsonObject | undefined {
  let current: unknown = root;
  for (const key of path) {
    if (!isObject(current)) {
      return undefined;
    }
    current = current[key];
  }
  return isObject(current) ? current : undefined;
}

function children(parent: JsonObject | undefined): JsonObject[] {
  return parent === undefined ? [] : Object.values(parent).filter(isObject);
}

/** A path segment that stands for any one key, such as a game, mod, download or collection id. */
export const ANY = Symbol("any key");

/** One step of a state path: a key, any key, or one of several keys. */
export type StatePathSegment = string | typeof ANY | readonly string[];

/** A state path from its hive down, which leaves out the value there and all below it. */
export type StatePath = readonly [string, ...StatePathSegment[]];

/**
 * What a mod's attributes copy from its page on Nexus Mods. The ids and the homepage stay, and so
 * do the newest version and the endorsement, which reports about updates and endorsing turn on.
 */
const MOD_PAGE_ATTRIBUTES = [
  "description",
  "shortDescription",
  "newestChangelog",
  "pictureUrl",
  "author",
  "uploader",
  "uploaderId",
  "uploaderUrl",
  "uploaderAvatar",
  "uploadedTimestamp",
  "updatedTimestamp",
  "allowRating",
];

/**
 * What a feedback leaves out of the state because the team can get it elsewhere: copies of Nexus
 * Mods pages and lists that are the same for every user. In real support bundles these were about
 * two thirds of the state, most of it the page description kept on every mod and again on every
 * download, and leaving them out is what keeps a large install's feedback to a couple of requests.
 * The mod, file and collection ids all stay, so anything left out can be looked up.
 *
 * This one list serves both ways the state is trimmed: main leaves these keys out as it reads the
 * persisted hives, without reading their values (`keyPatternFor`), and drops them from the
 * state it has built (`trimFeedbackState`), which covers the session and any value stored in
 * another shape, such as a whole object under one key.
 */
export const TRIMMED_PATHS: readonly StatePath[] = [
  // every extension on Nexus Mods, and every game Vortex's extensions support
  ["session", "extensions", "available"],
  ["session", "gameMode", "known"],
  // Vortex's own release notes
  ["persistent", "changelogs"],
  // what a mod copies from its page on Nexus Mods
  ["persistent", "mods", ANY, ANY, "attributes", MOD_PAGE_ATTRIBUTES],
  // the requirements of every mod, as the requirements check fetched them from Nexus Mods
  ["session", "healthCheck", "results", ANY, "metadata", "modRequirements"],
  ["persistent", "healthCheck", "results", ANY, "metadata", "modRequirements"],
  // the metadata server's answer for a downloaded file
  ["persistent", "downloads", "files", ANY, "modInfo", "meta"],
  // what Nexus Mods said about the mod and the file when it was downloaded; the ids stay
  ["persistent", "downloads", "files", ANY, "modInfo", "nexus", ["modInfo", "fileInfo"]],
  ["persistent", "downloads", "files", ANY, "modInfo", "nexus", "revisionInfo", "modFiles"],
  // a cached collection revision lists every file of the collection
  ["persistent", "collections", "revisions", ANY, "modFiles"],
  ["persistent", "collections", "revisions", ANY, "info", "modFiles"],
];

/** How the persistence joins the segments of a stored key. */
const KEY_SEPARATOR = "###";

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function segmentPattern(segment: StatePathSegment): string {
  if (segment === ANY) return "[^#]+";
  if (typeof segment === "string") return escapeRegExp(segment);
  return `(${segment.map(escapeRegExp).join("|")})`;
}

/**
 * The stored keys at `path` and below it, as a regular expression over the whole key. It is valid
 * both in RE2, which DuckDB matches with, and in JavaScript.
 */
export const statePathPattern = (path: StatePath): string =>
  `^${path.map(segmentPattern).join(KEY_SEPARATOR)}(${KEY_SEPARATOR}|$)`;

/** The stored keys of `hive` that `paths` leave out, as one pattern; it matches no key if none. */
export function keyPatternFor(hive: string, paths: readonly StatePath[]): string {
  const patterns = paths.filter(([first]) => first === hive).map(statePathPattern);
  // every stored key starts with its hive, so an empty key never comes up
  return patterns.length === 0 ? "^$" : patterns.join("|");
}

const segmentKeys = (node: JsonObject, segment: StatePathSegment): string[] => {
  if (segment === ANY) return Object.keys(node);
  return typeof segment === "string" ? [segment] : [...segment];
};

/** Drops the values at `path` below `node`, leaving alone whatever is not shaped as expected. */
function dropPath(node: JsonObject, path: readonly StatePathSegment[]): void {
  const [segment, ...rest] = path;
  if (segment === undefined) return;
  for (const key of segmentKeys(node, segment)) {
    if (rest.length === 0) {
      delete node[key];
    } else {
      const child = node[key];
      if (isObject(child)) dropPath(child, rest);
    }
  }
}

/** Drops the values at each of `paths` below `root`, leaving alone whatever is shaped otherwise. */
export function dropPaths(root: JsonObject, paths: readonly StatePath[]): void {
  for (const path of paths) {
    dropPath(root, path);
  }
}

/**
 * A collection's rule carries the list of files to take from the mod's archive, and its reference
 * carries the same list again. The copy on the reference goes, and only where it is the same.
 */
function dropDuplicateFileLists(rules: unknown): void {
  if (!Array.isArray(rules)) {
    return;
  }
  for (const rule of rules.filter(isObject)) {
    const reference = objectAt(rule, "reference");
    if (
      reference?.fileList !== undefined &&
      JSON.stringify(reference.fileList) === JSON.stringify(rule.fileList)
    ) {
      delete reference.fileList;
    }
  }
}

/** The file lists of every rule in the state, as text, to recognise a copy of one by. */
function ruleFileLists(games: JsonObject[]): Set<string> {
  const lists = new Set<string>();
  for (const game of games) {
    for (const mod of children(game)) {
      const rules: unknown[] = Array.isArray(mod.rules) ? mod.rules : [];
      for (const rule of rules.filter(isObject)) {
        if (rule.fileList !== undefined) {
          lists.add(JSON.stringify(rule.fileList));
        }
      }
    }
  }
  return lists;
}

/**
 * The file lists a collection copies, which only their values tell apart from a list of the user's
 * own and so no path can name. A rule's list is stamped onto the mod it installs and onto the
 * rule's reference; those copies go where the rule still holds the same list.
 */
function dropCopiedFileLists(exported: JsonObject): void {
  const games = children(objectAt(exported, "persistent", "mods"));
  // read before the rules are touched, as their own lists are what the copies are compared to
  const listsOnRules = ruleFileLists(games);
  for (const game of games) {
    for (const mod of children(game)) {
      const attributes = objectAt(mod, "attributes");
      if (
        attributes?.fileList !== undefined &&
        listsOnRules.has(JSON.stringify(attributes.fileList))
      ) {
        delete attributes.fileList;
      }
      dropDuplicateFileLists(mod.rules);
    }
  }
}

/**
 * Removes from an exported state what a feedback leaves out (`TRIMMED_PATHS`), and the file lists
 * a collection copies. Works in place, on the export's own copy of the state, and leaves alone
 * whatever is not shaped as expected.
 */
export function trimFeedbackState(exported: JsonObject): void {
  dropPaths(exported, TRIMMED_PATHS);
  dropCopiedFileLists(exported);
}
