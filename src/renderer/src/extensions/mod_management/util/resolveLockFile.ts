import { resolve, type Lockfile } from "@nexusmods/mod-pipeline";
import { VortexProfileId, type VortexGameId } from "@vortex/shared";

import type { IRegisteredExtension } from "../../../types/extensions";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { lastActiveProfileForGame } from "../../profile_management/selectors";
import { addGeneratedFiles } from "./generatedFiles";
import {
  LockfileContributions,
  type LockfileContribution,
  type LockfileContributionCondition,
} from "./lockfileContributions";
import { gatherResolverInput } from "./resolverInput";

const registeredContributions = new LockfileContributions();

/** The name a contribution is reported under: its extension's name, else its path. */
export function contributorOf(
  extensionPath?: string,
  extInfo?: Partial<IRegisteredExtension>,
): string {
  return extInfo?.name ?? extensionPath ?? "unknown";
}

/** Registers a contribution; the extension manager appends the caller's path and info. */
export function registerLockfileContribution(
  condition: LockfileContributionCondition,
  generate: LockfileContribution,
  extensionPath?: string,
  extInfo?: Partial<IRegisteredExtension>,
): void {
  registeredContributions.register(contributorOf(extensionPath, extInfo), condition, generate);
}

/** Adds the files contributions declare for the state the lockfile was resolved from. */
async function withGeneratedFiles(
  state: IState,
  gameMode: VortexGameId,
  profileId: VortexProfileId,
  contributions: LockfileContributions,
  lockfile: Lockfile,
): Promise<Lockfile> {
  const generatedFiles = await contributions.generatedFiles(state, gameMode, profileId);
  return addGeneratedFiles(lockfile, generatedFiles);
}

/** The game's lockfile: its enabled mods' files, then the files contributions declare. */
export async function resolveLockfile(
  api: IExtensionApi,
  gameMode: VortexGameId,
  contributions: LockfileContributions,
  hashFile: (filePath: string) => Promise<string>,
): Promise<Lockfile> {
  const state = api.getState();
  const profileId = VortexProfileId(lastActiveProfileForGame(state, gameMode));
  const { input } = await gatherResolverInput(api, profileId, hashFile);
  return withGeneratedFiles(state, gameMode, profileId, contributions, resolve(input));
}
