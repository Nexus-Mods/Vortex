import vm from "node:vm";

import type { IAdaptorManifest, IMethodMessage } from "@vortex/adaptor-api";

import * as adaptorApi from "@vortex/adaptor-api";
import {
  getProvidedUri,
  uri as validateUri,
  adaptorName,
  semVer,
} from "@vortex/adaptor-api";
import { parentPort } from "node:worker_threads";

import { createMethodDispatcher, createServiceProxy } from "./runtime.js";
import { createRpcTransport } from "./transport.js";

if (parentPort == null) {
  throw new Error("bootstrap must run inside a worker_threads Worker");
}

const transport = createRpcTransport(parentPort);

// Step 1: Wait for the init message from the host
interface InitMessage {
  type: "init";
  bundle: string;
  config: {
    name: string;
    version: string;
    requires: string[];
  };
}

const init = await transport.once<InitMessage>("init");
const { bundle, config } = init;

const allowedModules: Record<string, unknown> = {
  "@vortex/adaptor-api": adaptorApi,
};

// Step 2: Create a service container with proxies for each required URI
const container = new Map<string, unknown>();
for (const requiresUri of config.requires) {
  const proxy = createServiceProxy(requiresUri, (msg: IMethodMessage) =>
    transport.call(msg),
  );
  container.set(requiresUri, proxy);
}

// Step 3: Evaluate the bundle in a VM context with the container set on globalThis
const context = vm.createContext({
  __vortex_service_container: container,
});
const bundleModule = new vm.SourceTextModule(bundle, { context });

await bundleModule.link((specifier) => {
  if (!(specifier in allowedModules)) {
    throw new Error(`Adaptor sandbox: module "${specifier}" is not allowed`);
  }

  const exports = allowedModules[specifier] as Record<string, unknown>;

  const synth = new vm.SyntheticModule(
    Object.keys(exports),
    function () {
      for (const [k, v] of Object.entries(exports)) {
        this.setExport(k, v);
      }
    },
    { context },
  );

  return synth;
});

await bundleModule.evaluate();

// Step 4: Scan exports for @provides decorated classes
const dispatchers = new Map<
  string,
  (msg: IMethodMessage) => Promise<unknown>
>();
const providedUris: string[] = [];

for (const exportedValue of Object.values(bundleModule.namespace)) {
  if (typeof exportedValue !== "function") continue;

  const ctor = exportedValue as new (...args: unknown[]) => Record<string, (...args: unknown[]) => unknown>;
  const providedUri = getProvidedUri(ctor);
  if (providedUri == null) continue;

  const instance = new ctor();
  const dispatcher = createMethodDispatcher(providedUri, instance);
  dispatchers.set(providedUri, dispatcher);
  providedUris.push(providedUri);
}

// Step 5: Route incoming calls to the correct dispatcher.
// This MUST be registered before sending "ready", otherwise the host could
// send a call between receiving "ready" and the worker registering onCall.
transport.onCall(async (msg: IMethodMessage) => {
  const dispatcher = dispatchers.get(msg.uri);
  if (dispatcher == null) {
    throw new Error(`No dispatcher registered for URI: ${msg.uri}`);
  }
  return dispatcher(msg);
});

// Step 6: Build the manifest and send "ready"
const manifest: IAdaptorManifest = {
  id: validateUri(`adaptor:${config.name}`),
  name: adaptorName(config.name),
  version: semVer(config.version),
  provides: providedUris.map((u) => validateUri(u)),
  requires: config.requires.map((u) => validateUri(u)),
};

transport.send({ type: "ready", manifest });

// Step 7: Listen for shutdown
transport
  .once<{ type: "shutdown" }>("shutdown")
  .then(() => {
    transport.dispose();
    process.exit(0);
  })
  .catch(() => {});
