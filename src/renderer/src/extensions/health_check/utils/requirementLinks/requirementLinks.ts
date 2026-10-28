import type { IModRequirements } from "@nexusmods/nexus-api";

import type { IMod, IModRule } from "@/extensions/mod_management/types/IMod";
import renderModName from "@/extensions/mod_management/util/modName";
import {
  isDependencyRule,
  testModReference,
} from "@/extensions/mod_management/util/testModReference";

/** A Nexus requirement, as the mod requirements query returns it. */
export type INexusRequirementNode = IModRequirements["nexusRequirements"]["nodes"][number];

/** How a requirement is linked: by a rule of either type, or ignored, so not linked. */
export type RequirementLinkChoice = "requires" | "recommends" | "ignore";

/**
 * The mod attribute listing the Nexus UIDs of the mods it requires that the user chose to ignore,
 * so the choice is shown again rather than the requirement offered as new. It isn't kept as a rule
 * marked ignored, as enabling the mod would still offer to enable those.
 */
export const IGNORED_REQUIREMENTS_ATTRIBUTE = "ignoredNexusRequirements";

/** The Nexus UIDs of the mods the mod requires that the user ignores. */
export const ignoredRequirementsOf = (mod: IMod): string[] => {
  const ignored: unknown = mod.attributes?.[IGNORED_REQUIREMENTS_ATTRIBUTE];
  return Array.isArray(ignored) ? ignored.filter((uid) => typeof uid === "string") : [];
};

/** A Nexus requirement of one installed mod that another installed mod satisfies. */
export interface IRequirementLink {
  /** Unique per requiring mod and required Nexus mod. */
  key: string;
  sourceModId: string;
  sourceName: string;
  /** The installed mod that satisfies the requirement, preferring an enabled one. */
  targetModId: string;
  targetName: string;
  /** The required mod's Nexus UID, which every installed file of it shares. */
  targetUid: string;
  /** The author's note on the requirement, if they left one. */
  notes?: string;
  /** How it's linked now, or undefined while it's new: neither linked nor ignored. */
  current?: RequirementLinkChoice;
  /** The rule that links it now, which a change replaces or removes. */
  rule?: IModRule;
  /** For a file-level requirement: set when the mod is installed, but in no version it accepts. */
  wrongVersion?: IWrongVersion;
}

/** How the installed copy of a required mod falls short of a file-level requirement. */
export interface IWrongVersion {
  /** The installed copy's version, if it has one. */
  installed?: string;
  /** What the requirement accepts of that mod. */
  wanted: IMissingRequirementOption;
  /**
   * The installed version is one it accepts, of another file of the mod: an optional file, say,
   * where the main one is needed. Not older or newer, so the version alone wouldn't explain it.
   */
  differentFile: boolean;
}

/** A Nexus requirement of one installed mod that nothing installed satisfies. */
export interface IMissingRequirement {
  /** Unique per requiring mod and required Nexus mod, as a link's is. */
  key: string;
  sourceModId: string;
  sourceName: string;
  /** The mod that would satisfy it, or for a requirement with alternatives, each that would. */
  options: IMissingRequirementOption[];
  /** The author's note on the requirement, if they left one. */
  notes?: string;
}

export interface IMissingRequirementOption {
  /** Unknown only when Nexus couldn't be asked for it. */
  modName?: string;
  /** For a file-level requirement: the newest acceptable file's name. */
  fileName?: string;
  /** For a file-level requirement: the versions it accepts, oldest and newest. */
  versions?: { oldest: string; newest: string };
}

/** One file version that satisfies a file-level requirement. */
export interface IRequirementFile {
  fileUid: string;
  /** The Nexus UID of the mod it's a file of. */
  modUid: string;
  /** Its place among the versions of its file, higher being newer. */
  position: number;
  /** Filled in only for a requirement nothing installed satisfies, as it's then shown. */
  fileName?: string;
  version?: string;
  modName?: string;
}

/**
 * A file-level requirement of a mod's installed file: the file versions, across its alternatives,
 * any one of which satisfies it.
 */
export interface IFileRequirementDefinition {
  definitionId: string;
  files: IRequirementFile[];
}

export interface IFindRequirementLinksInput {
  mods: { [modId: string]: IMod };
  /** The mods whose own requirements are linked. */
  sourceModIds: string[];
  /** Nexus requirements, keyed by the requiring mod's UID. */
  requirements: Map<string, Partial<IModRequirements>>;
  /** File-level requirements, keyed by the requiring mod's id; none while they're unavailable. */
  fileRequirements: Map<string, IFileRequirementDefinition[]>;
  /** An installed mod's Nexus UID, or undefined for one that isn't from Nexus. */
  uidOf: (mod: IMod) => string | undefined;
  /** An installed mod's Nexus file UID, or undefined for one without a known file. */
  fileUidOf: (mod: IMod) => string | undefined;
  /** A requirement's Nexus UID, or undefined for one that can't be linked. */
  requirementUidOf: (req: INexusRequirementNode, sourceGameId: string) => string | undefined;
  /** Collection-managed mods have their requirements vetted by the collection, so are skipped. */
  isCollectionManaged: (mod: IMod) => boolean;
  isEnabled: (modId: string) => boolean;
  gameId: string;
}

const isNexusMod = (mod: IMod | undefined): mod is IMod =>
  mod !== undefined &&
  mod.type !== "collection" &&
  mod.attributes?.source === "nexus" &&
  !!mod.attributes?.modId;

/** Installed Nexus mods, by mod UID and by file UID. */
interface IInstalled {
  /** Enabled ones first. */
  byUid: Map<string, IMod[]>;
  byFileUid: Map<string, IMod>;
}

const enabledFirst = (input: IFindRequirementLinksInput) => (lhs: IMod, rhs: IMod) =>
  Number(input.isEnabled(rhs.id)) - Number(input.isEnabled(lhs.id));

function indexInstalled(input: IFindRequirementLinksInput): IInstalled {
  const byUid = new Map<string, IMod[]>();
  const byFileUid = new Map<string, IMod>();
  for (const mod of Object.values(input.mods).filter(isNexusMod)) {
    const uid = input.uidOf(mod);
    if (uid !== undefined) {
      byUid.set(uid, [...(byUid.get(uid) ?? []), mod]);
    }
    const fileUid = input.fileUidOf(mod);
    if (fileUid !== undefined) {
      byFileUid.set(fileUid, mod);
    }
  }
  for (const list of byUid.values()) {
    list.sort(enabledFirst(input));
  }
  return { byUid, byFileUid };
}

/** The mod's requires or recommends rule that one of the targets fulfils, if it has one. */
const dependencyRuleFor = (mod: IMod, targets: IMod[]): IModRule | undefined =>
  (mod.rules ?? []).find(
    (rule) =>
      isDependencyRule(rule) && targets.some((target) => testModReference(target, rule.reference)),
  );

/**
 * The requirements of the source mods that installed mods satisfy, and how each is linked now:
 * those listed on the mod page, then the file-level ones of its installed file. A mod required by
 * both is listed once, with the mod page's note and the file's version warning. External
 * requirements and those of collection-managed mods are left out.
 */
export function findRequirementLinks(input: IFindRequirementLinksInput): IRequirementLink[] {
  const installed = indexInstalled(input);
  const links: IRequirementLink[] = [];
  const add = (link: IRequirementLink | undefined) => {
    if (link === undefined) {
      return;
    }
    const existing = links.find((other) => other.key === link.key);
    if (existing === undefined) {
      links.push(link);
    } else {
      existing.wrongVersion ??= link.wrongVersion;
    }
  };

  for (const sourceModId of new Set(input.sourceModIds)) {
    const source = input.mods[sourceModId];
    if (!isNexusMod(source) || input.isCollectionManaged(source)) {
      continue;
    }
    const sourceUid = input.uidOf(source);
    const nodes = input.requirements.get(sourceUid)?.nexusRequirements?.nodes ?? [];
    const sourceGameId = source.attributes.downloadGame ?? input.gameId;

    for (const req of nodes) {
      add(linkFor(input, installed, source, req, sourceGameId));
    }
    for (const definition of input.fileRequirements.get(source.id) ?? []) {
      add(fileLinkFor(input, installed, source, definition));
    }
  }

  return links;
}

function linkFor(
  input: IFindRequirementLinksInput,
  installed: IInstalled,
  source: IMod,
  req: INexusRequirementNode,
  sourceGameId: string,
): IRequirementLink | undefined {
  if (req.externalRequirement) {
    return undefined;
  }
  const targetUid = input.requirementUidOf(req, sourceGameId);
  if (targetUid === undefined) {
    return undefined;
  }
  const targets = (installed.byUid.get(targetUid) ?? []).filter((mod) => mod.id !== source.id);
  return linkTo(source, targets, targetUid, req.notes?.trim() || undefined);
}

/**
 * A file-level requirement's link, to whichever acceptable file is installed, enabled first. With
 * none installed, to the mod installed in another version, with a warning: the link's rule takes
 * any version, so it's right once the mod is updated.
 */
function fileLinkFor(
  input: IFindRequirementLinksInput,
  installed: IInstalled,
  source: IMod,
  definition: IFileRequirementDefinition,
): IRequirementLink | undefined {
  const notSource = (mod: IMod | undefined): mod is IMod =>
    mod !== undefined && mod.id !== source.id;
  const accepted = definition.files
    .map((file) => installed.byFileUid.get(file.fileUid))
    .filter(notSource)
    .sort(enabledFirst(input));
  if (accepted.length > 0) {
    const targetUid = input.uidOf(accepted[0]);
    return targetUid === undefined ? undefined : linkTo(source, accepted, targetUid, undefined);
  }

  const others = [...new Set(definition.files.map((file) => file.modUid))]
    .flatMap((uid) => installed.byUid.get(uid) ?? [])
    .filter(notSource)
    .sort(enabledFirst(input));
  const targetUid = others.length > 0 ? input.uidOf(others[0]) : undefined;
  if (targetUid === undefined) {
    return undefined;
  }
  const link = linkTo(source, others, targetUid, undefined);
  const wanted = definition.files.filter((file) => file.modUid === targetUid);
  const version: string | undefined = others[0].attributes?.version || undefined;
  return link === undefined
    ? undefined
    : {
        ...link,
        wrongVersion: {
          installed: version,
          wanted: missingOption(wanted),
          differentFile: version !== undefined && wanted.some((file) => file.version === version),
        },
      };
}

/**
 * The link to the first of the targets, and how it's linked now: by the rule one of them
 * fulfils, if there's one, or else as ignored, if the user chose that.
 */
function linkTo(
  source: IMod,
  targets: IMod[],
  targetUid: string,
  notes: string | undefined,
): IRequirementLink | undefined {
  if (targets.length === 0) {
    return undefined;
  }
  const target = targets[0];
  const rule = dependencyRuleFor(source, targets);
  const ignored = ignoredRequirementsOf(source).includes(targetUid);
  return {
    key: `${source.id}:${targetUid}`,
    sourceModId: source.id,
    sourceName: renderModName(source),
    targetModId: target.id,
    targetName: renderModName(target),
    targetUid,
    notes,
    ...(rule !== undefined
      ? { current: rule.type as RequirementLinkChoice, rule }
      : ignored
        ? { current: "ignore" as const }
        : {}),
  };
}

/**
 * The requirements of the source mods that nothing installed satisfies, as the mod page and the
 * installed file list them. A mod required both ways is listed once, with the mod page's note and
 * the file's versions. A file-level requirement of a mod that is installed, only not in an
 * acceptable version, isn't missing: it's linked, with a warning.
 */
export function findMissingRequirements(input: IFindRequirementLinksInput): IMissingRequirement[] {
  const installed = indexInstalled(input);
  const missing: IMissingRequirement[] = [];

  for (const sourceModId of new Set(input.sourceModIds)) {
    const source = input.mods[sourceModId];
    if (!isNexusMod(source) || input.isCollectionManaged(source)) {
      continue;
    }
    const sourceName = renderModName(source);
    const keyOf = (uid: string) => `${source.id}:${uid}`;
    const isInstalled = (uid: string) =>
      (installed.byUid.get(uid) ?? []).some((mod) => mod.id !== source.id);

    const nodes = input.requirements.get(input.uidOf(source))?.nexusRequirements?.nodes ?? [];
    const sourceGameId = source.attributes.downloadGame ?? input.gameId;
    for (const req of nodes) {
      const uid = req.externalRequirement ? undefined : input.requirementUidOf(req, sourceGameId);
      if (uid === undefined || isInstalled(uid) || missing.some((m) => m.key === keyOf(uid))) {
        continue;
      }
      missing.push({
        key: keyOf(uid),
        sourceModId: source.id,
        sourceName,
        options: [{ modName: req.modName }],
        notes: req.notes?.trim() || undefined,
      });
    }

    for (const definition of input.fileRequirements.get(source.id) ?? []) {
      const uids = [...new Set(definition.files.map((file) => file.modUid))];
      const satisfied = definition.files.some((file) => installed.byFileUid.has(file.fileUid));
      if (satisfied || uids.some(isInstalled)) {
        continue;
      }
      const options = uids.map((uid) =>
        missingOption(definition.files.filter((file) => file.modUid === uid)),
      );
      // the mod page may list it too: its note stays, the file's versions are added
      const listed = missing.find((m) => uids.some((uid) => m.key === keyOf(uid)));
      if (listed !== undefined) {
        listed.options = options;
      } else {
        missing.push({ key: keyOf(uids[0]), sourceModId: source.id, sourceName, options });
      }
    }
  }

  return missing;
}

/** What to show of one mod's acceptable files: its name, the newest file and the version range. */
function missingOption(files: IRequirementFile[]): IMissingRequirementOption {
  const ordered = [...files].sort((lhs, rhs) => lhs.position - rhs.position);
  const oldest = ordered[0];
  const newest = ordered[ordered.length - 1];
  return {
    modName: files.find((file) => file.modName !== undefined)?.modName,
    fileName: newest?.fileName,
    versions:
      oldest?.version !== undefined && newest?.version !== undefined
        ? { oldest: oldest.version, newest: newest.version }
        : undefined,
  };
}

/**
 * The rule for a link. It references the required mod by its Nexus mod id with any version, so it
 * stays fulfilled when that mod updates or is installed from a different file.
 */
export function makeRequirementRule(
  link: IRequirementLink,
  target: IMod,
  type: Exclude<RequirementLinkChoice, "ignore">,
): IModRule {
  return {
    type,
    reference: {
      repo: {
        repository: "nexus",
        gameId: target.attributes.downloadGame,
        modId: String(target.attributes.modId),
        fileId: String(target.attributes.fileId ?? ""),
      },
      versionMatch: "*",
      description: link.targetName,
      idHint: target.id,
    },
    ...(link.notes !== undefined ? { comment: link.notes } : {}),
  };
}
