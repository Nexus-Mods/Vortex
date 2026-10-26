import type { IModRequirements } from "@nexusmods/nexus-api";

import type { IMod, IModRule } from "@/extensions/mod_management/types/IMod";
import renderModName from "@/extensions/mod_management/util/modName";
import {
  isDependencyRule,
  testModReference,
} from "@/extensions/mod_management/util/testModReference";

/** A Nexus requirement, as the mod requirements query returns it. */
export type INexusRequirementNode = IModRequirements["nexusRequirements"]["nodes"][number];

/** How a requirement is to be linked: as a rule of either type, or not at all. */
export type RequirementLinkChoice = "requires" | "recommends" | "skip";

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
}

export interface IFindRequirementLinksInput {
  mods: { [modId: string]: IMod };
  /** The mods whose own requirements are linked. */
  sourceModIds: string[];
  /** Nexus requirements, keyed by the requiring mod's UID. */
  requirements: Map<string, Partial<IModRequirements>>;
  /** An installed mod's Nexus UID, or undefined for one that isn't from Nexus. */
  uidOf: (mod: IMod) => string | undefined;
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

/** Installed Nexus mods by UID, enabled ones first. */
function installedByUid(input: IFindRequirementLinksInput): Map<string, IMod[]> {
  const byUid = new Map<string, IMod[]>();
  for (const mod of Object.values(input.mods).filter(isNexusMod)) {
    const uid = input.uidOf(mod);
    if (uid !== undefined) {
      byUid.set(uid, [...(byUid.get(uid) ?? []), mod]);
    }
  }
  for (const list of byUid.values()) {
    list.sort((lhs, rhs) => Number(input.isEnabled(rhs.id)) - Number(input.isEnabled(lhs.id)));
  }
  return byUid;
}

/** Whether the mod already has a requires or recommends rule that one of the targets fulfils. */
const hasDependencyRule = (mod: IMod, targets: IMod[]): boolean =>
  (mod.rules ?? []).some(
    (rule) =>
      isDependencyRule(rule) && targets.some((target) => testModReference(target, rule.reference)),
  );

/**
 * The requirements of the source mods that installed mods satisfy and that aren't linked yet.
 * External requirements and those of collection-managed mods are left out.
 */
export function findRequirementLinks(input: IFindRequirementLinksInput): IRequirementLink[] {
  const installed = installedByUid(input);
  const links: IRequirementLink[] = [];

  for (const sourceModId of new Set(input.sourceModIds)) {
    const source = input.mods[sourceModId];
    if (!isNexusMod(source) || input.isCollectionManaged(source)) {
      continue;
    }
    const sourceUid = input.uidOf(source);
    const nodes = input.requirements.get(sourceUid)?.nexusRequirements?.nodes ?? [];
    const sourceGameId = source.attributes.downloadGame ?? input.gameId;

    for (const req of nodes) {
      const link = linkFor(input, installed, source, req, sourceGameId);
      if (link !== undefined && !links.some((existing) => existing.key === link.key)) {
        links.push(link);
      }
    }
  }

  return links;
}

function linkFor(
  input: IFindRequirementLinksInput,
  installed: Map<string, IMod[]>,
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
  const targets = (installed.get(targetUid) ?? []).filter((mod) => mod.id !== source.id);
  if (targets.length === 0 || hasDependencyRule(source, targets)) {
    return undefined;
  }

  const target = targets[0];
  const notes = req.notes?.trim();
  return {
    key: `${source.id}:${targetUid}`,
    sourceModId: source.id,
    sourceName: renderModName(source),
    targetModId: target.id,
    targetName: renderModName(target),
    targetUid,
    notes: notes || undefined,
  };
}

/**
 * The rule for a link. It references the required mod by its Nexus mod id with any version, so it
 * stays fulfilled when that mod updates or is installed from a different file.
 */
export function makeRequirementRule(
  link: IRequirementLink,
  target: IMod,
  type: Exclude<RequirementLinkChoice, "skip">,
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
