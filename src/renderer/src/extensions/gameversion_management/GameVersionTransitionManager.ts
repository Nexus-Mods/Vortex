import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";

import type * as exeVersionT from "exe-version";

import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import getVortexPath from "../../util/getVortexPath";
import lazyRequire from "../../util/lazyRequire";
import { getGame } from "../gamemode_management/util/getGame";
import { addMod, setModAttribute } from "../mod_management/actions/mods";
import { BACKUP_TAG } from "../mod_management/LinkingDeployment";
import { installPathForGame } from "../mod_management/selectors";
import type { IMod } from "../mod_management/types/IMod";
import { getCurrentActivator } from "../mod_management/util/deploymentMethods";
import { setFeature, setModEnabled } from "../profile_management/actions/profiles";
import { setGameVersionJob } from "./actions";
import { loadCatalog, versionMatches } from "./catalog";
import type { ILoadedGameVersionCatalog } from "./catalog";
import {
  acquireArtifact,
  applyChunkMap,
  fingerprintDigest,
  hashFile,
  safePath,
} from "./fileOperations";
import type { GameVersionJobPhase } from "./types/IGameVersionState";
import type {
  IGameVersionFingerprint,
  IGameVersionPatchOperation,
  IGameVersionTarget,
  IGameVersionTransition,
  IGameVersionTransitionProvider,
} from "./types/IGameVersionTransitionProvider";

export type EnsureGameVersionResult =
  | "matched"
  | "prepared"
  | "skipped"
  | "canceled"
  | "unavailable";

export interface IGameVersionTransitionInspection {
  status: "matched" | "available" | "unavailable";
  actualVersion?: string;
  targetVersion?: string;
}

export type GameVersionTransitionSelection = "prompt" | "prepare" | "skip";

interface IResolvedTransition {
  provider: IGameVersionTransitionProvider;
  target: IGameVersionTarget;
  transition: IGameVersionTransition;
  catalogDigest: string;
}

interface ITransitionPlan extends IGameVersionTransitionInspection {
  compatibilityNote?: string;
  sourcePath?: string;
  resolved?: IResolvedTransition;
}

const GAME_VERSION_MOD_TYPE = "game-version";
const exeVersion: typeof exeVersionT = lazyRequire(() => require("exe-version"));

function sanitizeSegment(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function normalizeVersion(input: string): string {
  return input.trim().toLowerCase().replace(/\.0$/, "");
}

function isGameVersionMod(mod: IMod): boolean {
  return mod.type === GAME_VERSION_MOD_TYPE && mod.attributes?.gameVersionManaged === true;
}

export default class GameVersionTransitionManager {
  private mApi: IExtensionApi;
  private mProviders: IGameVersionTransitionProvider[];
  private mJobs = new Map<string, Promise<EnsureGameVersionResult>>();
  private mCatalogs = new Map<string, Promise<ILoadedGameVersionCatalog>>();
  private mUpdatingProfiles = new Set<string>();
  private mDeployedVersions = new Map<string, string>();

  constructor(api: IExtensionApi, providers: IGameVersionTransitionProvider[]) {
    this.mApi = api;
    this.mProviders = providers;
  }

  public ensure(
    gameId: string,
    requestedVersions: string[],
    selection: GameVersionTransitionSelection = "prompt",
  ): Promise<EnsureGameVersionResult> {
    if (requestedVersions.length === 0) {
      return Promise.resolve("unavailable");
    }
    const running = this.mJobs.get(gameId);
    if (running !== undefined) {
      return running;
    }
    const job = this.ensureImpl(gameId, requestedVersions, selection).finally(() =>
      this.mJobs.delete(gameId),
    );
    this.mJobs.set(gameId, job);
    return job;
  }

  public async inspect(
    gameId: string,
    requestedVersions: string[],
  ): Promise<IGameVersionTransitionInspection> {
    const { status, actualVersion, targetVersion } = await this.createPlan(
      gameId,
      requestedVersions,
    );
    return { status, actualVersion, targetVersion };
  }

  /** Reconcile generated mods and the active profile after startup. */
  public async reconcile(): Promise<void> {
    const state = this.mApi.getState() as IState;
    for (const [gameId, mods] of Object.entries(state.persistent.mods)) {
      for (const mod of Object.values(mods)) {
        if (isGameVersionMod(mod) && mod.attributes?.source !== "other") {
          this.mApi.store.dispatch(setModAttribute(gameId, mod.id, "source", "other"));
        }
      }
    }
    const current = this.mApi.getState() as IState;
    const profileId = current.settings.profiles.activeProfileId;
    const profile = current.persistent.profiles[profileId];
    if (profile !== undefined) {
      this.mDeployedVersions.set(profile.gameId, profile.features?.game_version ?? "store");
    }
    if (profile?.features?.game_version?.startsWith?.("managed:")) {
      await this.prepareProfileVersion(profileId, true);
    }
  }

  public async handleDeployment(profileId: string): Promise<void> {
    const state = this.mApi.getState() as IState;
    const profile = state.persistent.profiles[profileId];
    if (profile?.gameId !== "skyrimse") {
      return;
    }
    const preference = profile.features?.game_version ?? "store";
    if (this.mDeployedVersions.get(profile.gameId) === preference) {
      return;
    }
    await fs.rm(
      path.join(getVortexPath("localAppData"), "Skyrim Special Edition", "ContentCatalog.txt"),
      { force: true },
    );
    this.mDeployedVersions.set(profile.gameId, preference);
  }

  public isUpdatingProfile(profileId: string): boolean {
    return this.mUpdatingProfiles.has(profileId);
  }

  public handleModStateChange(profileId: string, modId: string, enabled: boolean): void {
    if (this.mUpdatingProfiles.has(profileId)) {
      return;
    }
    const state = this.mApi.getState() as IState;
    const profile = state.persistent.profiles[profileId];
    const mod = state.persistent.mods[profile?.gameId]?.[modId];
    if (profile === undefined || mod === undefined || !isGameVersionMod(mod)) {
      return;
    }

    this.mUpdatingProfiles.add(profileId);
    try {
      if (enabled) {
        for (const candidate of Object.values(state.persistent.mods[profile.gameId] ?? {})) {
          if (isGameVersionMod(candidate) && candidate.id !== modId) {
            this.mApi.store.dispatch(setModEnabled(profileId, candidate.id, false));
          }
        }
        this.mApi.store.dispatch(
          setFeature(
            profileId,
            "game_version",
            `managed:${mod.attributes.gameVersionTargetVersion}`,
          ),
        );
      } else {
        const active = Object.values(state.persistent.mods[profile.gameId] ?? {}).find(
          (candidate) =>
            isGameVersionMod(candidate) && profile.modState?.[candidate.id]?.enabled === true,
        );
        this.mApi.store.dispatch(
          setFeature(
            profileId,
            "game_version",
            active === undefined
              ? "store"
              : `managed:${active.attributes.gameVersionTargetVersion}`,
          ),
        );
      }
    } finally {
      this.mUpdatingProfiles.delete(profileId);
    }
  }

  public async handleModRemoval(gameId: string, modId: string): Promise<void> {
    const state = this.mApi.getState() as IState;
    const mod = state.persistent.mods[gameId]?.[modId];
    if (mod === undefined || !isGameVersionMod(mod)) {
      return;
    }
    const preference = `managed:${mod.attributes.gameVersionTargetVersion}`;
    for (const profile of Object.values(state.persistent.profiles)) {
      if (profile.gameId === gameId && profile.features?.game_version === preference) {
        this.mUpdatingProfiles.add(profile.id);
        try {
          this.mApi.store.dispatch(setFeature(profile.id, "game_version", "store"));
        } finally {
          this.mUpdatingProfiles.delete(profile.id);
        }
      }
    }
  }

  public async getProfileChoices(gameId: string): Promise<Array<{ value: string; label: string }>> {
    const state = this.mApi.getState() as IState;
    const discovery = state.settings.gameMode.discovered[gameId];
    const game = getGame(gameId);
    if (discovery?.path === undefined || game === undefined) {
      return [];
    }
    const sourceVersion = await this.storeVersion(gameId, discovery.path);
    const result = [{ value: "store", label: `${sourceVersion} (Store)` }];
    const provider = this.providerFor(gameId, discovery.store);
    if (provider === undefined) {
      return result;
    }
    let loaded: ILoadedGameVersionCatalog;
    try {
      loaded = await this.catalogFor(provider);
    } catch {
      return result;
    }
    const catalogGame = loaded.catalog.games.find(
      (entry) => entry.gameId === gameId && entry.store === discovery.store,
    );
    for (const target of catalogGame?.targets ?? []) {
      result.push({ value: `managed:${target.version}`, label: `${target.version} (Managed)` });
    }
    return result;
  }

  public async prepareProfileVersion(profileId: string, deployAfterSwitch = false): Promise<void> {
    const state = this.mApi.getState() as IState;
    const profile = state.persistent.profiles[profileId];
    if (profile === undefined) {
      return;
    }
    const preference = profile.features?.game_version ?? "store";
    if (preference === "store") {
      await this.setProfileVersion(profileId, "store", undefined, deployAfterSwitch);
      return;
    }
    if (typeof preference !== "string" || !preference.startsWith("managed:")) {
      throw new Error("The profile contains an invalid game-version selection");
    }
    const targetVersion = preference.slice("managed:".length);
    const discovery = state.settings.gameMode.discovered[profile.gameId];
    if (discovery?.path === undefined) {
      throw new Error("The game is not discovered");
    }

    let mod = this.findVersionMod(profile.gameId, targetVersion);
    if (mod === undefined) {
      const resolved = await this.resolve(profile.gameId, discovery.store, discovery.path, [
        targetVersion,
      ]);
      if (resolved === undefined) {
        throw new Error(
          `Managed game version ${targetVersion} cannot be prepared from this install`,
        );
      }
      mod = await this.prepareVersionMod(profile.gameId, discovery.path, resolved);
    }
    await this.setProfileVersion(profileId, preference, mod.id, deployAfterSwitch);
  }

  private setProgress(
    gameId: string,
    targetVersion: string,
    phase: GameVersionJobPhase,
    progress: number,
  ) {
    this.mApi.store.dispatch(
      setGameVersionJob({ gameId, job: { gameId, targetVersion, phase, progress } }),
    );
    this.mApi.sendNotification({
      id: `game-version-transition-${gameId}`,
      type: "activity",
      title: "Preparing compatible game version",
      message: `${phase[0].toUpperCase()}${phase.slice(1)} ${targetVersion}`,
      progress,
      noDismiss: true,
    });
  }

  private providerFor(gameId: string, store: string) {
    return this.mProviders.find(
      (provider) =>
        provider.supportedPlatforms.includes(process.platform) &&
        provider.supportedGames.includes(gameId) &&
        provider.supportedStores.includes(store),
    );
  }

  private catalogFor(provider: IGameVersionTransitionProvider) {
    let result = this.mCatalogs.get(provider.id);
    if (result === undefined) {
      result = loadCatalog(provider).catch((err) => {
        this.mCatalogs.delete(provider.id);
        throw err;
      });
      this.mCatalogs.set(provider.id, result);
    }
    return result;
  }

  private async resolve(
    gameId: string,
    store: string,
    sourcePath: string,
    requestedVersions: string[],
  ): Promise<IResolvedTransition | undefined> {
    const provider = this.providerFor(gameId, store);
    if (provider === undefined) {
      return undefined;
    }
    const loaded = await this.catalogFor(provider);
    const game = loaded.catalog.games.find(
      (entry) => entry.gameId === gameId && entry.store === store,
    );
    const target = game?.targets.find((candidate) =>
      requestedVersions.some((version) => versionMatches(candidate, version)),
    );
    if (target === undefined) {
      return undefined;
    }
    for (const transition of target.transitions) {
      if (await this.verifyStoreFingerprint(sourcePath, transition.source)) {
        return { provider, target, transition, catalogDigest: loaded.digest };
      }
    }
    return undefined;
  }

  private async versionsEquivalent(
    gameId: string,
    store: string,
    actualVersion: string,
    requestedVersions: string[],
  ): Promise<boolean> {
    const provider = this.providerFor(gameId, store);
    if (provider === undefined) {
      return false;
    }
    const loaded = await this.catalogFor(provider);
    const game = loaded.catalog.games.find(
      (entry) => entry.gameId === gameId && entry.store === store,
    );
    return (
      game?.targets.some(
        (target) =>
          versionMatches(target, actualVersion) &&
          requestedVersions.some((version) => versionMatches(target, version)),
      ) ?? false
    );
  }

  private async createPlan(gameId: string, requestedVersions: string[]): Promise<ITransitionPlan> {
    const state = this.mApi.getState() as IState;
    const discovery = state.settings.gameMode.discovered[gameId];
    const game = getGame(gameId);
    if (discovery?.path === undefined || game === undefined) {
      return { status: "unavailable" };
    }
    const actualVersion = await game.getInstalledVersion(discovery);
    if (
      requestedVersions.some(
        (requestedVersion) =>
          normalizeVersion(requestedVersion) === normalizeVersion(actualVersion),
      )
    ) {
      return { status: "matched", actualVersion };
    }
    try {
      if (
        await this.versionsEquivalent(gameId, discovery.store, actualVersion, requestedVersions)
      ) {
        return { status: "matched", actualVersion };
      }
    } catch {
      // Catalog failures fall through to the existing compatibility warning.
    }
    if (Object.keys(state.session.base.toolsRunning ?? {}).length > 0) {
      return { status: "unavailable", actualVersion };
    }
    const resolved = await this.resolve(gameId, discovery.store, discovery.path, requestedVersions);
    if (resolved === undefined) {
      return { status: "unavailable", actualVersion };
    }
    return {
      status: "available",
      actualVersion,
      targetVersion: resolved.target.version,
      compatibilityNote: resolved.target.compatibilityNote,
      sourcePath: discovery.path,
      resolved,
    };
  }

  private async ensureImpl(
    gameId: string,
    requestedVersions: string[],
    selection: GameVersionTransitionSelection,
  ): Promise<EnsureGameVersionResult> {
    const plan = await this.createPlan(gameId, requestedVersions);
    if (plan.status === "matched") {
      return "matched";
    }
    if (plan.status !== "available") {
      return "unavailable";
    }

    let prepare = selection === "prepare";
    if (selection === "prompt") {
      const choice = await this.mApi.showDialog(
        "question",
        "Prepare compatible game version",
        {
          text:
            "Vortex can prepare the required game files as a managed mod. During deployment, " +
            "the Hardlink Deployment method backs up the store files and restores them on purge." +
            (plan.compatibilityNote === undefined ? "" : `\n\n${plan.compatibilityNote}`),
          message: `Target version: ${plan.targetVersion}`,
        },
        [
          { label: "Cancel" },
          { label: "Continue Without Preparing" },
          { label: "Prepare Game Version" },
        ],
      );
      if (choice.action === "Cancel") {
        return "canceled";
      }
      prepare = choice.action === "Prepare Game Version";
    }
    if (!prepare) {
      return "skipped";
    }

    const profileId = (this.mApi.getState() as IState).settings.profiles.activeProfileId;
    if (profileId === undefined) {
      return "unavailable";
    }
    try {
      const mod = await this.prepareVersionMod(gameId, plan.sourcePath, plan.resolved);
      await this.setProfileVersion(
        profileId,
        `managed:${plan.resolved.target.version}`,
        mod.id,
        true,
      );
      return "prepared";
    } catch (err) {
      this.mApi.showErrorNotification("Failed to prepare a compatible game version", err, {
        allowReport: false,
      });
      return "unavailable";
    }
  }

  private async prepareVersionMod(
    gameId: string,
    sourcePath: string,
    resolved: IResolvedTransition,
  ): Promise<IMod> {
    const state = this.mApi.getState() as IState;
    const stagingPath = installPathForGame(state, gameId);
    if (stagingPath === undefined) {
      throw new Error("Game staging path is not configured");
    }
    if (getCurrentActivator(state, gameId, true)?.id !== "hardlink_activator") {
      throw new Error("Managed game versions require Hardlink Deployment for this game");
    }

    const targetDigest = fingerprintDigest(resolved.target.fingerprint);
    const modId = [
      "vortex-game-version",
      sanitizeSegment(resolved.provider.id),
      sanitizeSegment(resolved.target.version),
      targetDigest.slice(0, 12),
    ].join("-");
    const existing = (this.mApi.getState() as IState).persistent.mods[gameId]?.[modId];
    const finalPath = safePath(stagingPath, modId);
    if (
      existing !== undefined &&
      (await this.verifyPreparedFiles(finalPath, resolved.transition))
    ) {
      if (existing.attributes?.source === undefined) {
        this.mApi.store.dispatch(setModAttribute(gameId, modId, "source", "other"));
      }
      return existing;
    }

    const temporaryPath = safePath(stagingPath, `.installing-${modId}-${randomUUID()}`);
    const cacheRoot = safePath(stagingPath, path.join(".game-version-cache", "sha256"));
    this.setProgress(gameId, resolved.target.version, "planning", 0);
    await fs.mkdir(temporaryPath, { recursive: true });
    try {
      const patchOperations = resolved.transition.operations.filter(
        (operation): operation is IGameVersionPatchOperation => operation.type === "patch",
      );
      for (const [index, operation] of patchOperations.entries()) {
        this.setProgress(
          gameId,
          resolved.target.version,
          "patching",
          10 + Math.floor((index / Math.max(1, patchOperations.length)) * 80),
        );
        const sourceFile = await this.findStoreFile(
          sourcePath,
          operation.sourcePath,
          operation.sourceSha256,
        );
        const artifact = await acquireArtifact(operation.artifact, cacheRoot);
        const targetFile = safePath(temporaryPath, operation.targetPath);
        await fs.mkdir(path.dirname(targetFile), { recursive: true });
        if (operation.algorithm === "bsdiff40-v1") {
          await window.api.bsdiff.patch(sourceFile, targetFile, artifact);
        } else {
          await applyChunkMap(sourceFile, artifact, targetFile, operation.targetSize);
        }
        const targetHash = await hashFile(targetFile);
        if (
          targetHash.hash.toLowerCase() !== operation.targetSha256.toLowerCase() ||
          targetHash.numBytes !== operation.targetSize
        ) {
          throw new Error(`Patched game file failed verification: ${operation.targetPath}`);
        }
      }
      this.setProgress(gameId, resolved.target.version, "committing", 95);
      await fs.rm(finalPath, { recursive: true, force: true });
      await fs.rename(temporaryPath, finalPath);

      const mod: IMod = {
        id: modId,
        state: "installed",
        type: GAME_VERSION_MOD_TYPE,
        installationPath: modId,
        attributes: {
          name: `Game Version ${resolved.target.version}`,
          version: resolved.target.version,
          author: "Vortex",
          source: "other",
          description:
            "Game-version files managed by Vortex. Purging or disabling this mod restores the backed-up store files.",
          installTime: new Date(),
          gameVersionManaged: true,
          gameVersionProviderId: resolved.provider.id,
          gameVersionCatalogDigest: resolved.catalogDigest,
          gameVersionTargetVersion: resolved.target.version,
          gameVersionFingerprint: resolved.target.fingerprint,
          gameVersionRemovedFiles: resolved.transition.operations
            .filter((operation) => operation.type === "remove")
            .map((operation) => operation.targetPath),
        },
      };
      this.mApi.store.dispatch(addMod(gameId, mod));
      return mod;
    } finally {
      this.mApi.store.dispatch(setGameVersionJob({ gameId }));
      this.mApi.dismissNotification(`game-version-transition-${gameId}`);
      await fs.rm(temporaryPath, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async selectVersionMod(
    profileId: string,
    selectedModId: string | undefined,
    deploy: boolean,
  ): Promise<void> {
    const state = this.mApi.getState() as IState;
    const profile = state.persistent.profiles[profileId];
    if (profile === undefined) {
      return;
    }
    for (const mod of Object.values(state.persistent.mods[profile.gameId] ?? {})) {
      if (isGameVersionMod(mod)) {
        this.mApi.store.dispatch(setModEnabled(profileId, mod.id, mod.id === selectedModId));
      }
    }
    if (deploy) {
      await this.mApi.ext.awaitModsDeployment?.(profileId);
    }
    if (selectedModId !== undefined) {
      const mod = (this.mApi.getState() as IState).persistent.mods[profile.gameId]?.[selectedModId];
      this.mApi.sendNotification({
        id: `managed-game-version-${profile.gameId}`,
        type: "info",
        message: `Game version ${mod?.attributes?.gameVersionTargetVersion} is deployed by the active profile.`,
        allowSuppress: true,
        actions: [
          {
            title: "View in Profile Settings",
            action: (dismiss) => {
              this.mApi.events.emit("show-main-page", "game-profiles");
              dismiss();
            },
          },
        ],
      });
    } else {
      this.mApi.dismissNotification(`managed-game-version-${profile.gameId}`);
    }
  }

  private async setProfileVersion(
    profileId: string,
    preference: string,
    selectedModId: string | undefined,
    deploy: boolean,
  ): Promise<void> {
    this.mUpdatingProfiles.add(profileId);
    try {
      this.mApi.store.dispatch(setFeature(profileId, "game_version", preference));
      await this.selectVersionMod(profileId, selectedModId, deploy);
    } finally {
      this.mUpdatingProfiles.delete(profileId);
    }
  }

  private findVersionMod(gameId: string, targetVersion: string): IMod | undefined {
    return Object.values((this.mApi.getState() as IState).persistent.mods[gameId] ?? {}).find(
      (mod) => isGameVersionMod(mod) && mod.attributes?.gameVersionTargetVersion === targetVersion,
    );
  }

  private async verifyPreparedFiles(root: string, transition: IGameVersionTransition) {
    try {
      for (const operation of transition.operations) {
        if (operation.type !== "patch") {
          continue;
        }
        const result = await hashFile(safePath(root, operation.targetPath));
        if (
          result.hash.toLowerCase() !== operation.targetSha256.toLowerCase() ||
          result.numBytes !== operation.targetSize
        ) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  private async verifyStoreFingerprint(root: string, fingerprint: IGameVersionFingerprint) {
    for (const file of fingerprint.files) {
      const deployedPath = safePath(root, file.path);
      let matched = false;
      for (const candidate of [deployedPath + BACKUP_TAG, deployedPath]) {
        try {
          const result = await hashFile(candidate);
          if (
            result.hash.toLowerCase() === file.sha256.toLowerCase() &&
            (file.size === undefined || result.numBytes === file.size)
          ) {
            matched = true;
            break;
          }
        } catch {
          // Try the deployed path after the Vortex backup.
        }
      }
      if (!matched) {
        return false;
      }
    }
    return true;
  }

  private async findStoreFile(root: string, relativePath: string, expectedHash: string) {
    const deployedPath = safePath(root, relativePath);
    for (const candidate of [deployedPath + BACKUP_TAG, deployedPath]) {
      try {
        if ((await hashFile(candidate)).hash.toLowerCase() === expectedHash.toLowerCase()) {
          return candidate;
        }
      } catch {
        // Try the next candidate.
      }
    }
    throw new Error(`Store game file does not match the catalog: ${relativePath}`);
  }

  private async storeVersion(gameId: string, gamePath: string): Promise<string> {
    const game = getGame(gameId);
    if (game === undefined) {
      return "Unknown";
    }
    const executablePath = safePath(gamePath, game.executable(gamePath));
    const backupPath = executablePath + BACKUP_TAG;
    try {
      await fs.stat(backupPath);
      return exeVersion.default(backupPath);
    } catch {
      return game.getInstalledVersion({
        ...(this.mApi.getState() as IState).settings.gameMode.discovered[gameId],
        path: gamePath,
      });
    }
  }
}
