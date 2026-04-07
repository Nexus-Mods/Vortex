import * as fs from "node:fs/promises";
import * as path from "node:path";

import type {
  IAdaptorManifest,
  IMessageHandler,
  IMethodMessage,
} from "@vortex/adaptor-api/interfaces";
import type { PID } from "@vortex/adaptor-api/branded";
import { uri, messageId } from "@vortex/adaptor-api/branded";

import { AdaptorRegistry, NameService } from "./registry.js";
import { createMessageIdAllocator, createPidAllocator } from "./runtime.js";
import { createRpcTransport, type IRpcTransport } from "./transport.js";
import { createNodeWorker, type IWorkerHandle } from "./worker-factory.js";

/** Result of loading an adaptor via {@link IAdaptorHost.loadAdaptor}. */
export interface ILoadedAdaptor {
  manifest: IAdaptorManifest;
  pid: PID;
  call(serviceUri: string, method: string, args: unknown[]): Promise<unknown>;
}

/** Optional logger callback for adaptor host events. */
export type AdaptorHostLogger = (level: "info" | "warn" | "error", message: string) => void;

/**
 * Host-side orchestrator for loading and managing isolated adaptor Workers.
 */
export interface IAdaptorHost {
  loadAdaptor(config: {
    name: string;
    version: string;
    bundlePath: string;
    requires: string[];
  }): Promise<ILoadedAdaptor>;
  shutdown(pid: PID): Promise<void>;
  shutdownAll(): Promise<void>;
  registry: AdaptorRegistry;
  nameService: NameService;
}

interface WorkerEntry {
  pid: PID;
  handle: IWorkerHandle;
  transport: IRpcTransport;
}

export function createAdaptorHost(
  hostHandlers?: Record<string, IMessageHandler>,
  bootstrapPath?: string,
  logger?: AdaptorHostLogger,
): IAdaptorHost {
  const nameService = new NameService();
  const registry = new AdaptorRegistry();
  const nextPid = createPidAllocator();
  const nextMsgId = createMessageIdAllocator();
  const hostHandlerMap = new Map<string, IMessageHandler>(
    Object.entries(hostHandlers ?? {}),
  );
  const workers = new Map<string, WorkerEntry>();

  const log: AdaptorHostLogger = logger ?? ((level, msg) => {
    if (level === "error" || level === "warn") console.error(msg);
  });

  if (!bootstrapPath) {
    throw new Error("bootstrapPath is required");
  }
  const resolvedBootstrapPath = bootstrapPath;

  async function loadAdaptor(config: {
    name: string;
    version: string;
    bundlePath: string;
    requires: string[];
  }): Promise<ILoadedAdaptor> {
    const adaptorPid = nextPid();
    const bundle = await fs.readFile(config.bundlePath, "utf-8");
    const handle = createNodeWorker(resolvedBootstrapPath);
    const transport = createRpcTransport(handle.worker);

    // Register crash/exit handlers immediately so errors during init aren't lost
    handle.worker.on("error", (err: Error) => {
      log("error", `[adaptor-host] Worker ${config.name} (${adaptorPid}) error: ${err.message}`);
      cleanupWorker(adaptorPid);
    });
    handle.worker.on("exit", (code: number) => {
      if (code !== 0) {
        log("error", `[adaptor-host] Worker ${config.name} (${adaptorPid}) exited with code ${code}`);
        cleanupWorker(adaptorPid);
      }
    });

    // Handle reverse calls (adaptor → host services)
    transport.onCall(async (msg: IMethodMessage) => {
      const handler = hostHandlerMap.get(msg.uri);
      if (!handler) {
        throw new Error(`No host handler for URI: ${msg.uri}`);
      }
      return handler({
        type: uri(msg.uri),
        id: nextMsgId(),
        payload: { method: msg.method, args: msg.args },
      });
    });

    const readyPromise = transport.once<{ type: "ready"; manifest: IAdaptorManifest }>("ready");
    transport.send({
      type: "init",
      bundle,
      config: { name: config.name, version: config.version, requires: config.requires },
    });

    const { manifest } = await readyPromise;

    for (const provided of manifest.provides) {
      nameService.register(provided, adaptorPid);
    }
    registry.register(adaptorPid, manifest);
    workers.set(adaptorPid, { pid: adaptorPid, handle, transport });

    return {
      manifest,
      pid: adaptorPid,
      call(serviceUri: string, method: string, args: unknown[]): Promise<unknown> {
        return transport.call({ uri: serviceUri, method, args });
      },
    };
  }

  function cleanupWorker(workerPid: PID): void {
    const entry = workers.get(workerPid);
    if (!entry) return;
    entry.transport.dispose();
    workers.delete(workerPid);
    const registered = registry.get(workerPid);
    if (registered) {
      for (const provided of registered.manifest.provides) {
        nameService.unregister(provided);
      }
      registry.unregister(workerPid);
    }
  }

  async function shutdown(pid: PID): Promise<void> {
    const entry = workers.get(pid);
    if (!entry) return;
    entry.transport.send({ type: "shutdown" });
    // Wait for the worker to exit gracefully, force-terminate after 2s
    await Promise.race([
      new Promise<void>((resolve) => {
        entry.handle.worker.once("exit", () => resolve());
      }),
      new Promise<void>((resolve) =>
        setTimeout(() => {
          entry.handle.terminate().then(() => resolve(), () => resolve());
        }, 2000),
      ),
    ]);
    cleanupWorker(pid);
  }

  async function shutdownAll(): Promise<void> {
    const pids = [...workers.keys()] as PID[];
    await Promise.all(pids.map(shutdown));
  }

  return { loadAdaptor, shutdown, shutdownAll, registry, nameService };
}
