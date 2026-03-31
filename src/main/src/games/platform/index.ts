import type {
  DiagnosticResult,
  InstallPlan,
  InstallerMatch,
  InternalGameDiscoveryResult,
  InternalGameInstallRequest,
  InternalGameManifest,
  InternalGameRuntimeSnapshot,
  LoadOrderSnapshot,
  ToolLaunchPlan,
} from "@vortex/shared/ipc";

import { betterIpcMain } from "../../ipc";
import { createCyberpunkService } from "../cyberpunk";

interface InternalGameService {
  readonly id: string;
  getManifest(): InternalGameManifest;
  discover(): Promise<InternalGameDiscoveryResult | null>;
  runSetup(runtime: InternalGameRuntimeSnapshot): Promise<DiagnosticResult[]>;
  classifyInstall(
    request: InternalGameInstallRequest,
    runtime: InternalGameRuntimeSnapshot,
  ): Promise<InstallerMatch>;
  buildInstallPlan(
    request: InternalGameInstallRequest,
    runtime: InternalGameRuntimeSnapshot,
  ): Promise<InstallPlan>;
  compileLoadOrder(
    runtime: InternalGameRuntimeSnapshot,
  ): Promise<LoadOrderSnapshot>;
  applyLoadOrder(
    runtime: InternalGameRuntimeSnapshot,
    loadOrder: LoadOrderSnapshot,
  ): Promise<DiagnosticResult[]>;
  getToolLaunchPlan(
    toolId: string,
    runtime: InternalGameRuntimeSnapshot,
    executable: string,
    args: string[],
  ): Promise<ToolLaunchPlan>;
  getDiagnostics(runtime: InternalGameRuntimeSnapshot): Promise<DiagnosticResult[]>;
}

const services = new Map<string, InternalGameService>([
  ["cyberpunk2077", createCyberpunkService()],
]);

function requireService(gameId: string): InternalGameService {
  const service = services.get(gameId);
  if (service === undefined) {
    throw new Error(`Unknown internal game: ${gameId}`);
  }
  return service;
}

export function setupInternalGames(): void {
  betterIpcMain.handle("games:listInternal", () =>
    [...services.values()].map((service) => service.getManifest()),
  );
  betterIpcMain.handle("games:getManifest", (_event, gameId) =>
    services.get(gameId)?.getManifest() ?? null,
  );
  betterIpcMain.handle("games:discover", (_event, gameId) =>
    requireService(gameId).discover(),
  );
  betterIpcMain.handle("games:runSetup", (_event, gameId, runtime) =>
    requireService(gameId).runSetup(runtime),
  );
  betterIpcMain.handle("games:classifyInstall", (_event, gameId, request, runtime) =>
    requireService(gameId).classifyInstall(request, runtime),
  );
  betterIpcMain.handle("games:buildInstallPlan", (_event, gameId, request, runtime) =>
    requireService(gameId).buildInstallPlan(request, runtime),
  );
  betterIpcMain.handle("games:compileLoadOrder", (_event, gameId, runtime) =>
    requireService(gameId).compileLoadOrder(runtime),
  );
  betterIpcMain.handle("games:applyLoadOrder", (_event, gameId, runtime, loadOrder) =>
    requireService(gameId).applyLoadOrder(runtime, loadOrder),
  );
  betterIpcMain.handle(
    "games:getToolLaunchPlan",
    (_event, gameId, toolId, runtime, executable, args) =>
      requireService(gameId).getToolLaunchPlan(
        toolId,
        runtime,
        executable,
        args,
      ),
  );
  betterIpcMain.handle("games:getDiagnostics", (_event, gameId, runtime) =>
    requireService(gameId).getDiagnostics(runtime),
  );
}
