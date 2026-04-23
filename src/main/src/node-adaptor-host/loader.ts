import type {
  IAdaptorManifest,
  IMessageHandler,
  IMethodMessage,
  PID,
} from "@vortex/adaptor-api";

import { uri, messageId } from "@vortex/adaptor-api";
import * as fs from "node:fs/promises";

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
export type AdaptorHostLogger = (
  level: "info" | "warn" | "error",
  message: string,
) => void;

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

/**
 * A per-worker session produced by a {@link HostServiceFactory}. The
 * `handler` is the call target for this worker's RPC requests against the
 * service; `dispose()` is invoked when the worker is cleaned up (crash or
 * orderly shutdown) and should release any worker-scoped state (open
 * cursors, file handles, etc.).
 */
export interface HostServiceSession {
  handler: IMessageHandler;
  dispose?(): Promise<void>;
}

/**
 * Host-service definition that produces a fresh {@link HostServiceSession}
 * per worker. Use this when a service holds worker-scoped state that must
 * not leak across workers (e.g. directory enumeration cursors).
 */
export interface HostServiceFactory {
  perWorker(): HostServiceSession;
}

/**
 * A host-service definition. Either a bare {@link IMessageHandler} — shared
 * across every worker, no lifecycle — or a {@link HostServiceFactory} that
 * mints a fresh session per worker with an optional dispose hook.
 */
export type HostService = IMessageHandler | HostServiceFactory;

function isHostServiceFactory(value: HostService): value is HostServiceFactory {
  return typeof value === "object" && "perWorker" in value;
}

interface WorkerEntry {
  pid: PID;
  handle: IWorkerHandle;
  transport: IRpcTransport;
  sessions: HostServiceSession[];
}

export function createAdaptorHost(
  hostHandlers?: Record<string, HostService>,
  bootstrapPath?: string,
  logger?: AdaptorHostLogger,
): IAdaptorHost {
  const nameService = new NameService();
  const registry = new AdaptorRegistry();
  const nextPid = createPidAllocator();
  const nextMsgId = createMessageIdAllocator();
  const serviceDefs = new Map<string, HostService>(
    Object.entries(hostHandlers ?? {}),
  );
  const workers = new Map<PID, WorkerEntry>();

  const log: AdaptorHostLogger =
    logger ??
    ((level, msg) => {
      if (level === "error" || level === "warn") console.error(msg);
    });

  if (!bootstrapPath) {
    throw new Error("bootstrapPath is required");
  }

  async function loadAdaptor(config: {
    name: string;
    version: string;
    bundlePath: string;
    requires: string[];
  }): Promise<ILoadedAdaptor> {
    const adaptorPid = nextPid();
    const bundle = await fs.readFile(config.bundlePath, "utf-8");
    const handle = createNodeWorker(bootstrapPath);
    const transport = createRpcTransport(handle.worker);

    // Build a per-worker handler map. Bare handlers are shared across every
    // worker; factories are invoked once per worker so their sessions carry
    // worker-scoped state (and can release it at shutdown).
    const workerHandlers = new Map<string, IMessageHandler>();
    const workerSessions: HostServiceSession[] = [];
    for (const [serviceUri, def] of serviceDefs) {
      if (isHostServiceFactory(def)) {
        const session = def.perWorker();
        workerHandlers.set(serviceUri, session.handler);
        workerSessions.push(session);
      } else {
        workerHandlers.set(serviceUri, def);
      }
    }

    // Register crash/exit handlers immediately so errors during init aren't lost
    handle.worker.on("error", (err: Error) => {
      log(
        "error",
        `[adaptor-host] Worker ${config.name} (${adaptorPid}) error: ${err.message}`,
      );
      cleanupWorker(adaptorPid);
    });
    handle.worker.on("exit", (code: number) => {
      if (code !== 0) {
        log(
          "error",
          `[adaptor-host] Worker ${config.name} (${adaptorPid}) exited with code ${code}`,
        );
        cleanupWorker(adaptorPid);
      }
    });

    // Handle reverse calls (adaptor → host services)
    transport.onCall(async (msg: IMethodMessage) => {
      const handler = workerHandlers.get(msg.uri);
      if (!handler) {
        throw new Error(`No host handler for URI: ${msg.uri}`);
      }
      return handler({
        type: uri(msg.uri),
        id: nextMsgId(),
        payload: { method: msg.method, args: msg.args },
      });
    });

    const readyPromise = transport.once<{
      type: "ready";
      manifest: IAdaptorManifest;
    }>("ready");
    transport.send({
      type: "init",
      bundle,
      config: {
        name: config.name,
        version: config.version,
        requires: config.requires,
      },
    });

    const { manifest } = await readyPromise;

    for (const provided of manifest.provides) {
      nameService.register(provided, adaptorPid);
    }
    registry.register(adaptorPid, manifest);
    workers.set(adaptorPid, {
      pid: adaptorPid,
      handle,
      transport,
      sessions: workerSessions,
    });

    return {
      manifest,
      pid: adaptorPid,
      call(
        serviceUri: string,
        method: string,
        args: unknown[],
      ): Promise<unknown> {
        return transport.call({ uri: serviceUri, method, args });
      },
    };
  }

  function cleanupWorker(workerPid: PID): void {
    const entry = workers.get(workerPid);
    if (!entry) return;
    entry.transport.dispose();
    entry.handle.terminate().catch(() => {});
    // Release worker-scoped host service state (open cursors, file handles,
    // etc). Fire-and-forget: an individual dispose failure should not
    // prevent cleanup of the rest.
    for (const session of entry.sessions) {
      if (session.dispose !== undefined) {
        session.dispose().catch(() => undefined);
      }
    }
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
          entry.handle.terminate().then(
            () => resolve(),
            () => resolve(),
          );
        }, 2000),
      ),
    ]);
    cleanupWorker(pid);
  }

  async function shutdownAll(): Promise<void> {
    const pids = [...workers.keys()];
    await Promise.all(pids.map(shutdown));
  }

  return { loadAdaptor, shutdown, shutdownAll, registry, nameService };
}
