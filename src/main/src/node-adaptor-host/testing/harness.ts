import * as fs from "node:fs/promises";
import * as path from "node:path";

import type {
  IAdaptorManifest,
  IMessageHandler,
  IMethodMessage,
  URI,
} from "@nexusmods/adaptor-api";
import { uri } from "@nexusmods/adaptor-api";

import { createMessageIdAllocator } from "../runtime.js";
import { createRpcTransport } from "../transport.js";
import { createNodeWorker } from "../worker-factory.js";

/** Test harness backed by a real Worker thread. */
export interface ITestHarness {
  manifest: IAdaptorManifest;
  call(serviceUri: string, method: string, args: unknown[]): Promise<unknown>;
  registeredHandlers(): URI[];
  shutdown(): Promise<void>;
}

export async function createTestHarness(
  bundlePath: string,
  services?: Record<string, IMessageHandler>,
  bootstrapPath?: string,
): Promise<ITestHarness> {
  const resolvedBootstrap =
    bootstrapPath ?? path.resolve(import.meta.dirname, "../../build/bootstrap.mjs");

  const handle = createNodeWorker(resolvedBootstrap);
  const transport = createRpcTransport(handle.worker);
  const nextMsgId = createMessageIdAllocator();

  const hostHandlerMap = new Map<string, IMessageHandler>(Object.entries(services ?? {}));

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

  const bundle = await fs.readFile(bundlePath, "utf-8");
  const readyPromise = transport.once<{
    type: "ready";
    manifest: IAdaptorManifest;
  }>("ready");
  transport.send({
    type: "init",
    bundle,
    config: {
      name: path.basename(path.dirname(bundlePath)),
      version: "0.0.0-test",
      requires: Object.keys(services ?? {}),
    },
  });

  const { manifest } = await readyPromise;

  return {
    manifest,
    call(serviceUri: string, method: string, args: unknown[]): Promise<unknown> {
      return transport.call({ uri: serviceUri, method, args });
    },
    registeredHandlers(): URI[] {
      return manifest.provides.map((u) => uri(u));
    },
    async shutdown(): Promise<void> {
      transport.send({ type: "shutdown" });
      await handle.terminate();
      transport.dispose();
    },
  };
}
