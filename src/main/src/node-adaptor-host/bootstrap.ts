import { parentPort } from "node:worker_threads";
import * as adaptorApiBuilder from "@vortex/adaptor-api/builder";
import * as adaptorApiBranded from "@vortex/adaptor-api/branded";
import * as adaptorApiRuntimeContainer from "@vortex/adaptor-api/runtime-container";
import { getProvidedUri } from "@vortex/adaptor-api/builder";
import { uri as validateUri, adaptorName, semver } from "@vortex/adaptor-api/branded";
import type { IAdaptorManifest, IMethodMessage } from "@vortex/adaptor-api/interfaces";
import { activateContainer, createContainer, deactivateContainer } from "@vortex/adaptor-api/runtime-container";
import { createRpcTransport } from "./transport.js";
import { createMethodDispatcher, createServiceProxy } from "./runtime.js";

// Map of ESM modules to intercept in the CJS sandbox require.
// This ensures the bundle shares the same module instances as the bootstrap
// (avoiding ESM/CJS dual-package hazard for global state like the service container).
const esmModuleOverrides: Record<string, unknown> = {
  "@vortex/adaptor-api/builder": adaptorApiBuilder,
  "@vortex/adaptor-api/branded": adaptorApiBranded,
  "@vortex/adaptor-api/runtime-container": adaptorApiRuntimeContainer,
};

if (parentPort == null) {
  throw new Error("bootstrap.ts must run inside a worker_threads Worker");
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

// Step 2: Create a service container with proxies for each required URI
const container = createContainer();
for (const requiresUri of config.requires) {
  const proxy = createServiceProxy(requiresUri, (msg: IMethodMessage) => transport.call(msg));
  container.set(requiresUri, proxy);
}

// Step 3: Activate the container so virtual:services imports resolve
activateContainer(container);

// Step 4: Eval the bundle as CommonJS
const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
function sandboxRequire(specifier: string): unknown {
  if (specifier in esmModuleOverrides) return esmModuleOverrides[specifier];
  throw new Error(`Adaptor sandbox: module "${specifier}" is not allowed`);
}
// eslint-disable-next-line @typescript-eslint/no-implied-eval
new Function("module", "exports", "require", bundle)(moduleObj, moduleObj.exports, sandboxRequire);

// Step 5: Deactivate the container
deactivateContainer();

// Step 6: Scan exports for @provides decorated classes
const dispatchers = new Map<string, (msg: IMethodMessage) => Promise<unknown>>();
const providedUris: string[] = [];

for (const exportedValue of Object.values(moduleObj.exports)) {
  if (typeof exportedValue !== "function") continue;

  const ctor = exportedValue as new (...args: unknown[]) => unknown;
  const providedUri = getProvidedUri(ctor);
  if (providedUri == null) continue;

  const instance = new (ctor as new () => Record<string, (...args: unknown[]) => unknown>)();
  const dispatcher = createMethodDispatcher(providedUri, instance);
  dispatchers.set(providedUri, dispatcher);
  providedUris.push(providedUri);
}

// Step 7: Build the manifest and send "ready"
const manifest: IAdaptorManifest = {
  id: validateUri(`adaptor:${config.name}`),
  name: adaptorName(config.name),
  version: semver(config.version),
  provides: providedUris.map((u) => validateUri(u)),
  requires: config.requires.map((u) => validateUri(u)),
};

transport.send({ type: "ready", manifest });

// Step 8: Route incoming calls to the correct dispatcher
transport.onCall(async (msg: IMethodMessage) => {
  const dispatcher = dispatchers.get(msg.uri);
  if (dispatcher == null) {
    throw new Error(`No dispatcher registered for URI: ${msg.uri}`);
  }
  return dispatcher(msg);
});

// Step 9: Listen for shutdown
transport.once<{ type: "shutdown" }>("shutdown").then(() => {
  transport.dispose();
  process.exit(0);
});
