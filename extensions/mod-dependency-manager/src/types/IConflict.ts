import { IModLookupInfo } from "./IModLookupInfo";

export type ConflictSuggestion = "before" | "after" | null;

export interface IConflict {
  otherMod: IModLookupInfo;
  files: string[];
  suggestion: ConflictSuggestion;
}
