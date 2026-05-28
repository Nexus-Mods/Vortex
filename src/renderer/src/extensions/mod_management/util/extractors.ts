import type { IModInfo } from "modmeta-db";

import type { IModAttributes } from "../types/IMod";

interface IExtractorInput {
  meta?: IModInfo;
  custom?: {
    variant?: string;
  };
  previous?: IModAttributes;
}

export function attributeExtractor(input: IExtractorInput) {
  return Promise.resolve({
    version: input.meta?.fileVersion,
    logicalFileName: input.meta?.logicalFileName,
    rules: input.meta?.rules,
    source: input.meta?.source,
    category: input.meta?.details?.category,
    description: input.meta?.details?.description,
    author: input.meta?.details?.author,
    homepage: input.meta?.details?.homepage,
    variant: input.custom?.variant,
  });
}

export function upgradeExtractor(input: IExtractorInput) {
  return Promise.resolve({
    category: input.previous?.category,
    customFileName: input.previous?.customFileName,
    // Variant is install-identity, not metadata: an explicit choice from
    // the current install (custom.variant) must win over a stale value
    // leaked in via previous.attributes. See #23298.
    variant: input.custom?.variant != null ? undefined : input.previous?.variant,
    notes: input.previous?.notes,
    icon: input.previous?.icon,
    color: input.previous?.color,
  });
}
