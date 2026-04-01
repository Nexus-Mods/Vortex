import type { DiagnosticResult } from "@vortex/shared/ipc";
import * as React from "react";
import { Button } from "react-bootstrap";

import { useMainContext } from "../../contexts";
import type {
  IExtensionContext,
  IInstallResult,
  IInstruction,
  IRunParameters,
  IValidationResult,
  LoadOrder,
} from "../../types/api";
import GameStoreHelper from "../../util/GameStoreHelper";
import {
  getHealthCheckApi,
  registerCyberpunkDiagnosticsCheck,
} from "../health_check";

import CyberpunkArchiveInspectorPage from "./CyberpunkArchiveInspectorPage";
import CyberpunkLoadOrderItem from "./CyberpunkLoadOrderItem";
import {
  buildCyberpunkRuntimeSnapshot,
  CYBERPUNK_ARCHIVE_INSPECTOR_PAGE_ID,
  CYBERPUNK_REDDEPLOY_TOOL_ID,
  GAME_ID,
  getCyberpunkApi,
  getCyberpunkBucket,
  getCurrentCyberpunkLoadOrder,
  isCyberpunkActive,
} from "./common";
import { summarizeCyberpunkDiagnostics } from "./diagnosticSummary";

const STEAM_APP_ID = "1091500";
const GOG_APP_ID = "1423049311";
const EPIC_APP_ID = "Ginger";

interface ICyberpunkInstallTestResult {
  supported?: boolean;
  requiredFiles?: string[];
}

interface ICyberpunkInstallationPlan {
  instructions?: IInstruction[];
  diagnostics?: DiagnosticResult[];
  [key: string]: unknown;
}

function cyberpunkApi(): any {
  return getCyberpunkApi();
}

function queryPath() {
  return GameStoreHelper.findByAppId([
    STEAM_APP_ID,
    GOG_APP_ID,
    EPIC_APP_ID,
  ])
    .then((game) => game?.gamePath)
    .catch(() => undefined);
}

async function setupGame(context: IExtensionContext, discovery: any): Promise<void> {
  const cyberpunk = cyberpunkApi();
  if (typeof cyberpunk?.runSetup !== "function") {
    return;
  }

  try {
    await cyberpunk.runSetup(
      buildCyberpunkRuntimeSnapshot(context.api, {
        discovery: {
          path: discovery?.path,
          store: discovery?.store,
          tools: discovery?.tools,
        },
      }),
    );
  } catch (err) {
    context.api.showErrorNotification?.("Cyberpunk setup failed", err, {
      allowReport: false,
    });
  }
}

async function testSupported(
  context: IExtensionContext,
  files: string[],
  gameId: string,
  archivePath?: string,
  details?: any,
): Promise<ICyberpunkInstallTestResult> {
  const api = cyberpunkApi();
  if (typeof api?.classifyInstall !== "function") {
    return { supported: false, requiredFiles: [] };
  }

  try {
    const result = (await api.classifyInstall(
      {
        files: files.map((file) => ({ path: file })),
        stagingPath: details?.stagingPath ?? "",
        archivePath,
      },
      buildCyberpunkRuntimeSnapshot(context.api, { gameId }),
    )) as ICyberpunkInstallTestResult;
    return {
      supported: !!result?.supported,
      requiredFiles: result?.requiredFiles ?? [],
    };
  } catch {
    return { supported: false, requiredFiles: [] };
  }
}

async function installContent(
  context: IExtensionContext,
  files: string[],
  destinationPath: string,
  gameId: string,
  progressDelegate: (perc: number) => void,
  choices?: any,
  unattended?: boolean,
  archivePath?: string,
  options?: any,
): Promise<IInstallResult> {
  const api = cyberpunkApi();
  if (typeof api?.buildInstallPlan !== "function") {
    throw new Error("Cyberpunk install planner is unavailable.");
  }

  const plan = (await api.buildInstallPlan(
    {
      files: files.map((file) => ({ path: file })),
      stagingPath: destinationPath,
      archivePath,
    },
    buildCyberpunkRuntimeSnapshot(context.api, { gameId }),
  )) as ICyberpunkInstallationPlan;

  void progressDelegate;
  void choices;
  void unattended;
  void options;

  return { instructions: plan?.instructions ?? [] };
}

async function validateLoadOrder(
  prev: LoadOrder,
  current: LoadOrder,
): Promise<IValidationResult | undefined> {
  const invalid: Array<{ id: string; reason: string }> = [];
  let seenRedmod = false;

  current.forEach((entry: any) => {
    const bucket = getCyberpunkBucket(entry as any);
    if (bucket === "redmod") {
      seenRedmod = true;
      return;
    }

    if (seenRedmod) {
      invalid.push({
        id: entry.id,
        reason: "Archive mods must stay above REDmods.",
      });
    }
  });

  void prev;
  return invalid.length > 0 ? { invalid } : undefined;
}

function deserializeLoadOrder(
  context: IExtensionContext,
): Promise<LoadOrder> {
  const api = cyberpunkApi();
  if (typeof api?.compileLoadOrder !== "function") {
    return Promise.resolve([]);
  }
  return api
    .compileLoadOrder(buildCyberpunkRuntimeSnapshot(context.api))
    .then((snapshot: any) => snapshot?.entries ?? []);
}

async function serializeLoadOrder(
  context: IExtensionContext,
  loadOrder: LoadOrder,
  prev: LoadOrder,
): Promise<void> {
  const api = cyberpunkApi();
  if (typeof api?.applyLoadOrder !== "function") {
    return;
  }
  await api.applyLoadOrder(buildCyberpunkRuntimeSnapshot(context.api), {
    entries: loadOrder as any,
    validationMessages: [],
  });
  void prev;
}

function CyberpunkLoadOrderUsage(): JSX.Element {
  const { api } = useMainContext();
  const loadOrder = getCurrentCyberpunkLoadOrder(api);
  const [diagnostics, setDiagnostics] = React.useState<DiagnosticResult[]>([]);
  const [loadingDiagnostics, setLoadingDiagnostics] = React.useState(false);
  const [diagnosticsError, setDiagnosticsError] = React.useState<string | undefined>(undefined);
  const archiveCount = loadOrder.filter(
    (entry) => getCyberpunkBucket(entry as any) === "archive",
  ).length;
  const redmodCount = loadOrder.filter(
    (entry) => getCyberpunkBucket(entry as any) === "redmod",
  ).length;
  const summary = summarizeCyberpunkDiagnostics(diagnostics);

  const refreshDiagnostics = React.useCallback(async () => {
    const cyberpunk = cyberpunkApi();
    if (typeof cyberpunk?.getDiagnostics !== "function") {
      setDiagnostics([]);
      setDiagnosticsError("Cyberpunk diagnostics are unavailable.");
      return;
    }

    setLoadingDiagnostics(true);
    setDiagnosticsError(undefined);
    try {
      const nextDiagnostics = await cyberpunk.getDiagnostics(
        buildCyberpunkRuntimeSnapshot(api),
      );
      setDiagnostics(nextDiagnostics ?? []);
    } catch (err) {
      setDiagnosticsError(
        err instanceof Error ? err.message : "Failed to load Cyberpunk diagnostics.",
      );
    } finally {
      setLoadingDiagnostics(false);
    }
  }, [api]);

  React.useEffect(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div>
        Cyberpunk mods stay in their authored format. Archives remain archives and REDmods
        remain REDmods. Keep archives above REDmods in this list.
      </div>
      <div>
        <strong>Current buckets:</strong> {archiveCount} archive entries, {redmodCount} REDmod entries.
      </div>
      <div>
        <strong>Diagnostics:</strong>{" "}
        {loadingDiagnostics
          ? "loading"
          : summary.total > 0
            ? `${summary.total} issues`
            : "no issues detected"}
        {summary.conflicts > 0 ? ` | ${summary.conflicts} conflicts` : ""}
        {summary.parser > 0 ? ` | ${summary.parser} parser issues` : ""}
        {summary.dependencies > 0 ? ` | ${summary.dependencies} dependency issues` : ""}
        {summary.other > 0 ? ` | ${summary.other} other` : ""}
      </div>
      {diagnosticsError ? (
        <div className="text-danger">{diagnosticsError}</div>
      ) : null}
      {!loadingDiagnostics && diagnostics.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {diagnostics.slice(0, 3).map((diagnostic) => (
            <div key={diagnostic.id}>
              <strong>{diagnostic.title}</strong>: {diagnostic.message}
            </div>
          ))}
          {diagnostics.length > 3 ? (
            <div>{diagnostics.length - 3} more Cyberpunk diagnostics are available in Health Check.</div>
          ) : null}
        </div>
      ) : null}
      <div>
        Use the archive inspector for read-only browsing of `.archive` contents and conflict
        details.
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <Button bsStyle="default" onClick={() => void refreshDiagnostics()}>
          Refresh diagnostics
        </Button>
        <Button
          bsStyle="primary"
          onClick={() =>
            api.events.emit("show-main-page", CYBERPUNK_ARCHIVE_INSPECTOR_PAGE_ID)
          }
        >
          Open archive inspector
        </Button>
      </div>
    </div>
  );
}

function detectToolId(call: IRunParameters): string | undefined {
  const executable = `${call?.executable ?? ""}`.toLowerCase();
  if (executable.includes("redmod") || executable.endsWith("redmod.exe")) {
    return CYBERPUNK_REDDEPLOY_TOOL_ID;
  }
  return undefined;
}

function isCyberpunkTool(call: IRunParameters): boolean {
  const executable = `${call?.executable ?? ""}`.toLowerCase();
  const cwd = `${call?.options?.cwd ?? ""}`.toLowerCase();
  return (
    executable.includes("cyberpunk2077.exe") ||
    executable.includes("redmod") ||
    cwd.includes("cyberpunk 2077") ||
    cwd.includes("cyberpunk2077")
  );
}

function main(context: IExtensionContext): boolean {
  context.registerGame({
    id: GAME_ID,
    name: "Cyberpunk 2077",
    mergeMods: true,
    queryPath,
    queryModPath: () => ".",
    executable: () => "bin\\x64\\Cyberpunk2077.exe",
    requiredFiles: ["bin\\x64\\Cyberpunk2077.exe"],
    environment: {
      SteamAPPId: STEAM_APP_ID,
      GogAPPId: GOG_APP_ID,
      EpicAPPId: EPIC_APP_ID,
    },
    setup: ((discovery) => setupGame(context, discovery)) as any,
    details: {
      steamAppId: +STEAM_APP_ID,
      gogAppId: GOG_APP_ID,
      epicAppId: EPIC_APP_ID,
    },
  });

  context.registerInstaller(
    "cyberpunk2077-authored",
    20,
    ((files, gameId, archivePath, details) =>
      testSupported(context, files, gameId, archivePath, details)) as any,
    ((files, destinationPath, gameId, progressDelegate, choices, unattended, archivePath, options) =>
      installContent(
        context,
        files,
        destinationPath,
        gameId,
        progressDelegate,
        choices,
        unattended,
        archivePath,
        options,
      )) as any,
  );

  context.registerStartHook(50, "cyberpunk2077-launch-plan", async (call) => {
    if (!isCyberpunkActive(context.api.getState()) || !isCyberpunkTool(call)) {
      return call;
    }

    const api = cyberpunkApi();
    if (typeof api?.getToolLaunchPlan !== "function") {
      return call;
    }

    try {
      const plan = await api.getToolLaunchPlan(
        detectToolId(call),
        buildCyberpunkRuntimeSnapshot(context.api),
        call.executable,
        call.args,
      );
      if (plan?.handled || plan?.executable != null || plan?.args != null || plan?.options != null) {
        return {
          ...call,
          executable: plan?.executable ?? call.executable,
          args: plan?.args ?? call.args,
          options: {
            ...(call.options ?? {}),
            ...(plan?.options ?? {}),
          },
        };
      }
    } catch (err) {
      context.api.showErrorNotification(
        "Cyberpunk launch planning failed",
        err,
        { allowReport: false },
      );
    }

    return call;
  });

  context.registerLoadOrder({
    gameId: GAME_ID,
    clearStateOnPurge: false,
    deserializeLoadOrder: (() => deserializeLoadOrder(context)) as any,
    serializeLoadOrder: ((loadOrder, prev) =>
      serializeLoadOrder(context, loadOrder, prev)) as any,
    validate: validateLoadOrder as any,
    usageInstructions: CyberpunkLoadOrderUsage as any,
    customItemRenderer: CyberpunkLoadOrderItem as any,
    toggleableEntries: true,
  });

  context.registerMainPage(
    "archive",
    "Cyberpunk archive inspector",
    CyberpunkArchiveInspectorPage,
    {
      id: CYBERPUNK_ARCHIVE_INSPECTOR_PAGE_ID,
      group: "per-game",
      priority: 40,
      visible: () => isCyberpunkActive(context.api.getState()),
      hotkey: "I",
    },
  );

  context.once(async () => {
    const healthCheckApi = getHealthCheckApi();
    if (healthCheckApi == null) {
      return;
    }

    await registerCyberpunkDiagnosticsCheck(context.api, healthCheckApi, {
      getGameId: () => GAME_ID,
      getDiagnostics: async () => {
        const api = cyberpunkApi();
        if (typeof api?.getDiagnostics !== "function") {
          return [];
        }
        return api.getDiagnostics(buildCyberpunkRuntimeSnapshot(context.api));
      },
    });
  });

  return true;
}

export default main;
