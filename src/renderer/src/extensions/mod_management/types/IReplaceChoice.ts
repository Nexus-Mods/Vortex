import type { IRule } from "modmeta-db";

import type { IModAttributes } from "./IMod";

/**
 * How the user resolved a mod name conflict at install time: "replace" swaps the existing mod
 * across all local profiles, "variant" installs a second coexisting copy under a variant name.
 */
export type ReplaceChoice = "replace" | "variant";

export interface IReplaceChoice {
  id: string;
  variant: string;
  enable: boolean;
  attributes: IModAttributes;
  rules: IRule[];
  replaceChoice: ReplaceChoice;
}
