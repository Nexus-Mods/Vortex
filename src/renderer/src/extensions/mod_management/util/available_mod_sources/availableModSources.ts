import type { IModSource } from "../../types/IModSource";
import { getModSources } from "../modSource";

/** The sources a user can say a mod came from: every one registered whose condition holds. */
export const availableModSources = (): IModSource[] =>
  getModSources().filter((source) => source.options?.condition?.() ?? true);
