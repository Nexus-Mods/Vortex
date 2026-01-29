import { createSelector } from "reselect";
import { types } from "vortex-api";

const getCollectionInstallState = (
  state: types.IState,
): types.ICollectionInstallState =>
  (state as any).session?.collections || {
    activeSession: undefined,
    lastActiveSessionId: undefined,
    sessionHistory: {},
  };

export const getActiveInstallSession = createSelector(
  [getCollectionInstallState],
  (installState): types.ICollectionInstallSession | undefined =>
    installState.activeSession,
);

export const isInstallationActive = createSelector(
  [getActiveInstallSession],
  (activeSession): boolean => activeSession !== undefined,
);

export const getCollectionInstallProgress = createSelector(
  [
    getActiveInstallSession,
    (_state: types.IState, collectionId: string) => collectionId,
  ],
  (
    activeSession,
    collectionId,
  ): { installed: number; total: number } | null => {
    if (!activeSession || activeSession.collectionId !== collectionId) {
      return null;
    }

    return {
      installed: activeSession.installedCount,
      total: activeSession.totalRequired + activeSession.totalOptional,
    };
  },
);

export const getRequiredModsProgress = createSelector(
  [
    getActiveInstallSession,
    (_state: types.IState, collectionId: string) => collectionId,
  ],
  (
    activeSession,
    collectionId,
  ): { installed: number; total: number; failed: number } | null => {
    if (!activeSession || activeSession.collectionId !== collectionId) {
      return null;
    }

    const requiredMods = Object.values(activeSession.mods).filter(
      (mod) => mod.type === "requires",
    );
    const installed = requiredMods.filter(
      (mod) => mod.status === "installed",
    ).length;
    const failed = requiredMods.filter((mod) => mod.status === "failed").length;

    return {
      installed,
      total: activeSession.totalRequired,
      failed,
    };
  },
);

export const getOptionalModsProgress = createSelector(
  [
    getActiveInstallSession,
    (_state: types.IState, collectionId: string) => collectionId,
  ],
  (
    activeSession,
    collectionId,
  ): { installed: number; total: number; skipped: number } | null => {
    if (!activeSession || activeSession.collectionId !== collectionId) {
      return null;
    }

    const optionalMods = Object.values(activeSession.mods).filter(
      (mod) => mod.type === "recommends",
    );
    const installed = optionalMods.filter(
      (mod) => mod.status === "installed",
    ).length;
    const skipped = optionalMods.filter(
      (mod) => mod.status === "skipped",
    ).length;

    return {
      installed,
      total: activeSession.totalOptional,
      skipped,
    };
  },
);

export const getCollectionModsStatus = createSelector(
  [
    getActiveInstallSession,
    (_state: types.IState, collectionId: string) => collectionId,
  ],
  (activeSession, collectionId) => {
    if (!activeSession || activeSession.collectionId !== collectionId) {
      return [];
    }

    return Object.entries(activeSession.mods).map(([ruleId, modInfo]) => ({
      ruleId,
      modName:
        modInfo.rule.reference.description ||
        modInfo.rule.reference.logicalFileName ||
        "Unknown Mod",
      status: modInfo.status,
      type: modInfo.type,
      modId: modInfo.modId,
    }));
  },
);

export const getInstallationSummary = createSelector(
  [getActiveInstallSession],
  (activeSession) => {
    if (!activeSession) {
      return {
        isActive: false,
      };
    }

    return {
      isActive: true,
      collectionId: activeSession.collectionId,
      gameId: activeSession.gameId,
      installedMods: activeSession.installedCount,
      totalMods: activeSession.totalRequired + activeSession.totalOptional,
      requiredMods: {
        installed: Object.values(activeSession.mods).filter(
          (m) => m.type === "requires" && m.status === "installed",
        ).length,
        total: activeSession.totalRequired,
      },
    };
  },
);
