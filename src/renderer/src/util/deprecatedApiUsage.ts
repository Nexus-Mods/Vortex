import AnalyticsMixpanel from "../extensions/analytics/mixpanel/MixpanelAnalytics";
import { AppDeprecatedApiUsedEvent } from "../extensions/analytics/mixpanel/MixpanelEvents";
import { log } from "../logging";
import type { IRegisteredExtension } from "../types/extensions";
import type { IExtensionState } from "../types/IState";

/**
 * Bounded reporter handed to deprecated surface factories: emits the log warning (deduped per
 * method across the whole session) and the Mixpanel event (deduped per extension and method).
 */
export type DeprecatedApiReporter = (method: string, replacement?: string) => void;

/**
 * A deprecated API surface. `makeForCaller` builds the per-caller instance handed out in place of
 * the shared export; the instance reports through the given reporter (which carries the calling
 * extension and its resolved installed state) on any property access.
 */
export interface IDeprecatedApiSurface {
  makeForCaller(report: DeprecatedApiReporter): unknown;
}

/**
 * Registry of deprecated extension-api surfaces, keyed by the export's path in the api namespace
 * (e.g. "util.steam"). Registering is the only thing a future deprecation has to do: the
 * per-extension api proxy consults this registry on every property lookup.
 */
const registry = new Map<string, IDeprecatedApiSurface>();

export function registerDeprecatedApi(exportPath: string, surface: IDeprecatedApiSurface): void {
  registry.set(exportPath, surface);
}

function findDeprecatedSurface(exportPath: string): IDeprecatedApiSurface | undefined {
  return registry.get(exportPath);
}

function hasDeprecatedDescendant(exportPath: string): boolean {
  for (const key of registry.keys()) {
    if (key.startsWith(`${exportPath}.`)) {
      return true;
    }
  }
  return false;
}

const warnedMethods = new Set<string>();
const reportedPairs = new Set<string>();

/**
 * Reports a deprecated API access by the given caller. `state` is the caller's installed-extension
 * entry, resolved by the handout point (or undefined when no state entry matched). The log warning
 * fires once per session per method (method-global, matching the pre-telemetry shim behavior) with
 * the extension named in the metadata; the Mixpanel event fires once per session per
 * extension-and-method pair.
 */
export function reportDeprecatedApiUsage(
  caller: IRegisteredExtension,
  state: IExtensionState | undefined,
  method: string,
  replacement: string | undefined,
): void {
  if (!warnedMethods.has(method)) {
    warnedMethods.add(method);
    log("warn", `"${method}" is deprecated`, {
      replacement,
      extension: caller.name,
    });
  }

  const pairKey = `${caller.name}\u0000${method}`;
  if (reportedPairs.has(pairKey)) {
    return;
  }
  reportedPairs.add(pairKey);

  AnalyticsMixpanel.trackEvent(
    new AppDeprecatedApiUsedEvent({
      api_method: method,
      extension_name: caller.name,
      extension_version: state?.version,
      mod_id: state?.modId,
      file_id: state?.fileId,
      bundled: Boolean(state?.bundled),
    }),
  );
}

/** Binds a caller and its resolved installed state into a reporter closure for per-caller surfaces. */
export function makeCallerReporter(
  caller: IRegisteredExtension,
  state: IExtensionState | undefined,
): DeprecatedApiReporter {
  return (method, replacement) => reportDeprecatedApiUsage(caller, state, method, replacement);
}

// Per-caller instances, keyed by caller object then by export path, so identity stays stable
// within an extension across repeated property reads.
const callerWrappers = new WeakMap<IRegisteredExtension, Map<string, unknown>>();

function cachedForCaller(
  caller: IRegisteredExtension,
  cacheKey: string,
  make: () => unknown,
): unknown {
  let perCaller = callerWrappers.get(caller);
  if (perCaller === undefined) {
    perCaller = new Map();
    callerWrappers.set(caller, perCaller);
  }
  if (!perCaller.has(cacheKey)) {
    perCaller.set(cacheKey, make());
  }
  return perCaller.get(cacheKey);
}

function wrapNamespace<T extends object>(
  childTarget: T,
  exportPath: string,
  caller: IRegisteredExtension,
  state: IExtensionState | undefined,
): T {
  return new Proxy<T>(childTarget, {
    get: (target, prop, receiver) =>
      deprecatedApiGet(target, prop, exportPath, caller, state, receiver),
  });
}

/**
 * The complete property-read trap for an extension-api namespace object handed to an extension.
 * Registered deprecated surfaces are replaced by per-caller instances (cached per caller and
 * export path, so identity stays stable); namespace members containing registered surfaces are
 * wrapped recursively; everything else reads through untouched.
 *
 * `exportPath` is the dotted path of `target` within the api namespace ("" for the root).
 */
export function deprecatedApiGet<T extends object>(
  target: T,
  key: PropertyKey,
  exportPath: string,
  caller: IRegisteredExtension,
  state: IExtensionState | undefined,
  receiver?: unknown,
): unknown {
  if (typeof key !== "string") {
    return Reflect.get(target, key, receiver);
  }

  const childPath = exportPath === "" ? key : `${exportPath}.${key}`;

  const surface = findDeprecatedSurface(childPath);
  if (surface !== undefined) {
    return cachedForCaller(caller, childPath, () =>
      surface.makeForCaller(makeCallerReporter(caller, state)),
    );
  }

  if (hasDeprecatedDescendant(childPath)) {
    const child = Reflect.get(target, key);
    if (child !== null && (typeof child === "object" || typeof child === "function")) {
      return cachedForCaller(caller, childPath, () =>
        wrapNamespace(child, childPath, caller, state),
      );
    }
  }

  return Reflect.get(target, key, receiver);
}
