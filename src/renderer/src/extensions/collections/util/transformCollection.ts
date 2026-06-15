import * as path from "path";

import type { ILookupResult } from "modmeta-db";
import { generate as shortid } from "shortid";

import { log } from "../../../logging";
import type { IConditionResult, IDialogContent } from "../../../types/IDialog";
import type { TFunction } from "../../../util/i18n";
import type { IGameStored } from "../../gamemode_management/types/IGameStored";
import type { IMod, IModReference, IModRule } from "../../mod_management/types/IMod";
import { coerceToSemver } from "../../mod_management/util/coerceToSemver";
import { findModByRef } from "../../mod_management/util/findModByRef";
import renderModName from "../../mod_management/util/modName";
import { makeModReference } from "../../mod_management/util/modReference";
import testModReference from "../../mod_management/util/testModReference";
import { convertGameIdReverse } from "../../nexus_integration/util/convertGameId";
import { MAX_COLLECTION_NAME_LENGTH, MIN_COLLECTION_NAME_LENGTH, MOD_TYPE } from "../constants";
import type {
  ICollection,
  ICollectionInfo,
  ICollectionMod,
  ICollectionModRule,
  ICollectionSourceInfo,
} from "../types/ICollection";

export function sanitizeExpression(fileName: string): string {
  // drop extension and anything like ".1" or " (1)" at the end which probaby
  // indicates duplicate downloads (either in our own format or common browser
  // style)
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/\.\d+$/, "")
    .replace(/ \(\d+\)$/, "");
}

export function toInt(input: string | number | undefined | null) {
  if (!input) {
    return 0;
  }

  if (typeof input === "string") {
    return parseInt(input, 10);
  }

  return input;
}

export function deduceSource(
  mod: IMod,
  sourceInfo: ICollectionSourceInfo,
  versionMatcher: string,
  metaInfo: ILookupResult[],
  tag: string,
): ICollectionSourceInfo {
  const res: Partial<ICollectionSourceInfo> =
    sourceInfo !== undefined ? { ...sourceInfo } : { type: "nexus" };

  // "manual" with a URL is functionally identical to "browse"
  if (res.type === "manual" && res.url) {
    res.type = "browse";
  }

  const assign = (obj: any, key: string, value: any) => {
    if (obj[key] === undefined) {
      obj[key] = value;
    }
  };

  if (res.type === "nexus") {
    if (mod.attributes?.source !== "nexus") {
      throw new Error(`"${renderModName(mod)}" doesn't have Nexus as its source`);
    }
    const modId = mod.type === MOD_TYPE ? mod.attributes?.collectionId : mod.attributes?.modId;
    const fileId = mod.type === MOD_TYPE ? mod.attributes?.revisionId : mod.attributes?.fileId;
    // don't accept undefined, 0 or ''
    if (!modId || !fileId || isNaN(modId) || isNaN(fileId)) {
      throw new Error(`"${mod.id}" is missing mod id or file id`);
    }

    res.modId = toInt(modId);
    res.fileId = toInt(fileId);
  } else {
    assign(res, "adultContent", sourceInfo?.adultContent);
  }

  if (["browse", "direct"].includes(res.type) && !res.url) {
    throw new Error(`"${mod.id}" has no URL set`);
  }

  // since we store bundled mods uncompressed the md5 hash won't be the same
  if (sourceInfo?.type !== "bundle") {
    assign(res, "md5", mod.attributes?.fileMD5);
  }
  assign(res, "fileSize", mod.attributes?.fileSize);
  // prefering the logical name from the meta db because on imported files, the file may
  // have been renamed before installation
  assign(
    res,
    "logicalFilename",
    metaInfo?.[0]?.value?.logicalFileName ?? mod.attributes?.logicalFileName,
  );
  if (sourceInfo?.updatePolicy !== undefined) {
    assign(res, "updatePolicy", sourceInfo.updatePolicy);
  } else if (sourceInfo?.type === "bundle") {
    assign(res, "updatePolicy", "exact");
  } else {
    if (versionMatcher === "*") {
      assign(res, "updatePolicy", "latest");
    } else if (versionMatcher !== undefined && versionMatcher.endsWith("+prefer")) {
      assign(res, "updatePolicy", "prefer");
    } else {
      assign(res, "updatePolicy", "exact");
    }
  }

  if (
    res.md5 === undefined &&
    res.logicalFilename === undefined &&
    res.fileExpression === undefined &&
    mod.attributes?.fileName !== undefined
  ) {
    assign(res, "fileExpression", sanitizeExpression(mod.attributes.fileName));
  }

  assign(res, "tag", tag);

  return res as ICollectionSourceInfo;
}

export function generateCollection(
  info: ICollectionInfo,
  mods: ICollectionMod[],
  modRules: ICollectionModRule[],
): ICollection {
  return {
    info,
    mods,
    modRules,
  };
}

export function makeBiDirRule(source: IModReference, rule: IModRule): ICollectionModRule {
  if (rule === undefined) {
    return undefined;
  }

  return {
    type: rule.type,
    reference: rule.reference,
    source,
  };
}

export function makeTransferrable(
  mods: { [modId: string]: IMod },
  collection: IMod,
  rule: IModRule,
): IModRule {
  let newRef: IModReference = { ...rule.reference };
  const mod = findModByRef(rule.reference, mods);

  if (
    rule.reference.fileMD5 === undefined &&
    rule.reference.logicalFileName === undefined &&
    rule.reference.fileExpression === undefined
  ) {
    // a rule that doesn't contain any of the above markers will likely not be able to match
    // anything on a different system

    if (rule.reference.id === undefined) {
      // rule unusable
      log("warn", "invalid rule couldn't be included in the collection", JSON.stringify(rule));
      return undefined;
    }

    if (mod === undefined) {
      log("warn", "mod enabled in collection isn't installed", JSON.stringify(rule));
      return undefined;
    }

    newRef = makeModReference(mod);
  }

  // ok, this gets a bit complex now. If the referenced mod gets updated, also make sure
  // the rules referencing it apply to newer versions
  if (mod !== undefined) {
    const mpRule = collection.rules.find((iter) => testModReference(mod, iter.reference));
    if (
      mpRule !== undefined &&
      (mpRule.reference.versionMatch === undefined ||
        mpRule.reference.versionMatch === "*" ||
        mpRule.reference.versionMatch.startsWith(">="))
    ) {
      newRef.versionMatch = "*";
    }
  }

  return {
    type: rule.type,
    fileList: rule.fileList,
    comment: rule.comment,
    reference: newRef,
  };
}

/**
 * convert a mod entry from a collection into a mod rule
 */
export function collectionModToRule(knownGames: IGameStored[], mod: ICollectionMod): IModRule {
  const downloadHint = ["manual", "browse", "direct"].includes(mod.source.type)
    ? {
        url: mod.source.url,
        instructions: mod.source.instructions,
        mode: mod.source.type,
      }
    : undefined;

  const coerced = coerceToSemver(mod.version);

  const { updatePolicy } = mod.source;

  let versionMatch: string;
  if (updatePolicy === "prefer") {
    versionMatch = coerced ? `>=${coerced ?? "0.0.0"}+prefer` : coerceToSemver(mod.version);
  } else if (updatePolicy === "latest") {
    versionMatch = "*";
  } else {
    // Default to 'exact' for undefined or explicit 'exact' updatePolicy
    versionMatch = coerced ? coerced : coerceToSemver(mod.version);
  }

  // we can't use the md5 hash for a bundled file because they are recompressed
  // during collection install and then the hash won't match
  const refMD5: string = mod.source.type === "bundle" ? undefined : mod.source.md5;

  const fileExpression =
    updatePolicy === "exact" || mod.source.logicalFilename === undefined
      ? mod.source.fileExpression
      : undefined;

  const reference: IModReference = {
    description: mod.name,
    fileMD5: refMD5,
    gameId: convertGameIdReverse(knownGames, mod.domainName),
    fileSize: mod.source.fileSize,
    versionMatch,
    logicalFileName: mod.source.logicalFilename,
    fileExpression,
    tag: mod.source.tag ?? shortid(),
  };

  if (["latest", "prefer"].includes(updatePolicy)) {
    reference["md5Hint"] = mod.source.md5;
  }

  if (mod.source.type === "nexus") {
    if (!mod.source.modId || !mod.source.fileId) {
      const err = new Error("Invalid nexus repo specification");
      err["mod"] = mod;
      throw err;
    }
    reference["repo"] = {
      repository: "nexus",
      gameId: mod.domainName,
      modId: mod.source.modId.toString(),
      fileId: mod.source.fileId.toString(),
      campaign: "collection",
    };
  }

  const res: IModRule = {
    type: mod.optional ? "recommends" : "requires",
    reference,
    fileList: mod.hashes,
    installerChoices: mod.choices,
    patches: mod.patches,
    downloadHint,
    extra: {
      author: mod.author,
      type: mod.details?.type,
      category: mod.details?.category,
      version: mod.version,
      url: mod.source.url,
      name: mod.name,
      instructions: mod.instructions
        ? mod.instructions
        : mod.source.type === "manual"
          ? mod.source.instructions
          : undefined,
      phase: mod.phase ?? 0,
      fileOverrides: mod.fileOverrides,
    },
  };

  if (mod.source.type === "bundle") {
    res.extra.localPath = path.join("bundled", mod.source.fileExpression);
  }

  return res;
}

export function validateName(t: TFunction, content: IDialogContent): IConditionResult[] {
  const input = content.input[0].value || "";
  if (input.length >= MIN_COLLECTION_NAME_LENGTH && input.length <= MAX_COLLECTION_NAME_LENGTH) {
    return [];
  } else {
    return [
      {
        id: "name",
        errorText: t("Name must be between {{min}}-{{max}} characters long", {
          replace: {
            min: MIN_COLLECTION_NAME_LENGTH,
            max: MAX_COLLECTION_NAME_LENGTH,
          },
        }),
        actions: ["Create"],
      },
    ];
  }
}

export function makeCollectionId(baseId: string): string {
  return `vortex_collection_${baseId}`;
}
