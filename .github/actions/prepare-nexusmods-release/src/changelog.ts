/**
 * Aggregates release notes for the Nexus Mods Upload API from `CHANGELOG.md`.
 *
 * The Upload API takes a single plain-text description, but our changelog is
 * split across a stable entry and the beta entries that preceded it. For a
 * stable release we therefore collect every entry from the release itself back
 * to (but excluding) the previous stable release, then flatten them into one
 * list grouped by Keep-a-Changelog section.
 */

import * as fs from "node:fs";

/** Section headings in the order the Upload API description lists them. */
const SECTION_ORDER = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"] as const;

/** A `## [version] - date` block of the changelog. */
export interface ChangelogEntry {
  /** Version as written in the heading (e.g. `2.4.0-beta.1`). */
  version: string;
  /** Bullets keyed by section heading (e.g. `Fixed`). */
  sections: Map<string, string[]>;
}

/** Matches a version heading, with or without a trailing date. */
const VERSION_HEADING = /^##\s+\[([^\]]+)\]/;

/** Matches a section heading (`### Fixed`). */
const SECTION_HEADING = /^###\s+(.+?)\s*$/;

/** Matches a top-level list item. */
const BULLET = /^[-*]\s+(.*)$/;

/**
 * True when a version has no prerelease suffix (e.g. `2.4.0`, not
 * `2.4.0-beta.1`). Stable versions terminate the backwards walk.
 */
export function isStableVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version);
}

/**
 * Parses `CHANGELOG.md` into its version entries, newest first.
 *
 * Non-bullet prose (such as the italic `_Stable 2.4 release._` notes) and
 * bullets that appear before any section heading are ignored.
 *
 * @param markdown - Full contents of `CHANGELOG.md`.
 * @returns Entries in document order, which is newest-first by convention.
 */
export function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let entry: ChangelogEntry | undefined;
  let section: string | undefined;

  for (const line of markdown.split(/\r?\n/)) {
    const [, headingVersion] = VERSION_HEADING.exec(line) ?? [];
    if (headingVersion !== undefined) {
      entry = { version: headingVersion, sections: new Map() };
      section = undefined;
      entries.push(entry);
      continue;
    }

    const [, headingSection] = SECTION_HEADING.exec(line) ?? [];
    if (headingSection !== undefined) {
      section = headingSection;
      continue;
    }

    if (entry === undefined || section === undefined) {
      continue;
    }

    const [, bullet] = BULLET.exec(line) ?? [];
    if (bullet !== undefined) {
      const bullets = entry.sections.get(section) ?? [];
      bullets.push(bullet.trim());
      entry.sections.set(section, bullets);
      continue;
    }

    // Indented continuation of the previous bullet - fold it into that bullet.
    const bullets = entry.sections.get(section);
    const last = bullets?.at(-1);
    if (bullets !== undefined && last !== undefined && /^\s+\S/.test(line)) {
      bullets[bullets.length - 1] = `${last} ${line.trim()}`;
    }
  }

  return entries;
}

/**
 * Selects the entries that belong to a release: the entry for `version`
 * itself plus every prerelease entry below it, stopping at the previous
 * stable release.
 *
 * @param entries - Parsed changelog entries, newest first.
 * @param version - Version being published, without a leading `v`.
 * @returns The matching entries, newest first.
 *
 * # Errors
 *
 * Throws if no entry for `version` exists - publishing with wrong or empty
 * release notes is worse than failing the workflow.
 */
export function selectEntriesForVersion(
  entries: ChangelogEntry[],
  version: string,
): ChangelogEntry[] {
  const start = entries.findIndex((candidate) => candidate.version === version);
  if (start === -1) {
    throw new Error(
      `No CHANGELOG.md entry found for version ${version}. Add a '## [${version}]' section before publishing.`,
    );
  }

  const selected: ChangelogEntry[] = [];
  for (const entry of entries.slice(start)) {
    if (selected.length > 0 && isStableVersion(entry.version)) {
      break;
    }
    selected.push(entry);
  }
  return selected;
}

/**
 * Converts a changelog bullet to the plain text the Upload API displays:
 * markdown links collapse to their label (so `([#1](url))` becomes `(#1)`),
 * code spans and bold markers are dropped.
 *
 * Underscores and single asterisks are left alone - they occur inside real
 * identifiers such as `__vortex_tmp_`.
 */
export function toPlainText(bullet: string): string {
  return bullet
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

/**
 * Builds the plain-text release notes for a version: one bullet per line,
 * grouped by section in Keep-a-Changelog order, newest entry first within
 * each section.
 *
 * @param markdown - Full contents of `CHANGELOG.md`.
 * @param version - Version being published, without a leading `v`.
 * @returns Newline-separated release notes.
 *
 * # Errors
 *
 * Throws if `version` has no changelog entry (via
 * {@link selectEntriesForVersion}).
 */
export function buildReleaseNotes(markdown: string, version: string): string {
  const selected = selectEntriesForVersion(parseChangelog(markdown), version);

  // Sections not covered by SECTION_ORDER are appended in first-seen order.
  const known = new Set<string>(SECTION_ORDER);
  const extra: string[] = [];
  for (const entry of selected) {
    for (const section of entry.sections.keys()) {
      if (!known.has(section) && !extra.includes(section)) {
        extra.push(section);
      }
    }
  }

  const lines: string[] = [];
  for (const section of [...SECTION_ORDER, ...extra]) {
    for (const entry of selected) {
      for (const bullet of entry.sections.get(section) ?? []) {
        lines.push(toPlainText(bullet));
      }
    }
  }

  return lines.join("\n");
}

/**
 * Reads `CHANGELOG.md` from disk and builds the release notes for a version.
 *
 * # Errors
 *
 * Throws if the file cannot be read, or if `version` has no changelog entry.
 */
export function readReleaseNotes(changelogPath: string, version: string): string {
  return buildReleaseNotes(fs.readFileSync(changelogPath, "utf8"), version);
}
