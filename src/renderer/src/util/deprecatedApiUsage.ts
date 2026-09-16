import AnalyticsMixpanel from "../extensions/analytics/mixpanel/MixpanelAnalytics";
import { AppDeprecatedApiUsedEvent } from "../extensions/analytics/mixpanel/MixpanelEvents";
import { findInstalled } from "../extensions/extension_manager/queries";
import { log } from "../logging";
import type { IRegisteredExtension } from "../types/extensions";
import type { IExtensionState } from "../types/IState";

/**
 * Provides the currently installed extensions map (the `app.extensions` state hive, keyed by
 * extension id). Threading rather than a module singleton so the source stays explicit; the getter
 * is valid from before the first extension init onwards.
 */
export type GetInstalledExtensions = () => Record<string, IExtensionState>;

/**
 * Bounded reporter handed to deprecated surface factories: emits the log warning (deduped per
 * method across the whole session) and the Mixpanel event (deduped per extension and method).
 */
export type DeprecatedApiReporter = (method: string, replacement?: string) => void;

/**
 * A deprecated API surface. `makeForCaller` builds the per-caller instance handed out in place of
 * the shared export; the instance reports through the given reporter (which carries the calling
 * extension) on any property access.
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

function resolveCallerState(
  caller: IRegisteredExtension,
  getInstalled?: GetInstalledExtensions,
): IExtensionState | undefined {
  if (getInstalled === undefined) {
    return undefined;
  }
  try {
    return findInstalled(getInstalled(), { path: caller.path })?.extension;
  } catch {
    return undefined;
  }
}

/**
 * Reports a deprecated API access by the given caller. The log warning fires once per session per
 * method (method-global, matching the pre-telemetry shim behavior) with the extension named in the
 * metadata; the Mixpanel event fires once per session per extension-and-method pair.
 */
export function reportDeprecatedApiUsage(
  caller: IRegisteredExtension,
  method: string,
  replacement: string | undefined,
  getInstalled?: GetInstalledExtensions,
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

  const state = resolveCallerState(caller, getInstalled);
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

/** Binds a caller (and the state getter) into a reporter closure for per-caller surfaces. */
export function makeCallerReporter(
  caller: IRegisteredExtension,
  getInstalled?: GetInstalledExtensions,
): DeprecatedApiReporter {
  return (method, replacement) =>
    reportDeprecatedApiUsage(caller, method, replacement, getInstalled);
}

const NOT_DEPRECATED = Symbol("not-deprecated");

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
  getInstalled?: GetInstalledExtensions,
): T {
  return new Proxy<T>(childTarget, {
    get(target, prop, receiver) {
      const resolved = resolveDeprecatedAccess(target, prop, exportPath, caller, getInstalled);
      if (resolved !== NOT_DEPRECATED) {
        return resolved;
      }

      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Generic delegation for a property read on an extension-api namespace object. Returns the
 * replacement value when the property (identified by its dotted `exportPath` within the api
 * namespace) is registered as deprecated, or when it is a namespace containing registered
 * exports (wrapped recursively); otherwise returns the NOT_DEPRECATED sentinel and the caller
 * should pass the property through untouched.
 */
export function resolveDeprecatedAccess<T extends object>(
  target: T,
  key: PropertyKey,
  exportPath: string,
  caller: IRegisteredExtension,
  getInstalled?: GetInstalledExtensions,
): unknown {
  if (typeof key !== "string") {
    return NOT_DEPRECATED;
  }

  const childPath = exportPath === "" ? key : `${exportPath}.${key}`;

  const surface = findDeprecatedSurface(childPath);
  if (surface !== undefined) {
    return cachedForCaller(caller, childPath, () =>
      surface.makeForCaller(makeCallerReporter(caller, getInstalled)),
    );
  }

  if (hasDeprecatedDescendant(childPath)) {
    const child = Reflect.get(target, key);
    if (child !== null && (typeof child === "object" || typeof child === "function")) {
      return cachedForCaller(caller, childPath, () =>
        wrapNamespace(child, childPath, caller, getInstalled),
      );
    }
  }

  return NOT_DEPRECATED;
}
