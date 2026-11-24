// HMR client for the renderer dev loop. Dev only: dev.mjs passes this file, after
// rolldown's DevRuntime, to the dev engine as `experimental.devMode.implement`,
// so it runs at the top of renderer.mjs, before any renderer module.
//
// Rolldown's dev engine produces a patch per change but leaves delivery and the
// HMR decisions to the client. There is no dev server here: the renderer is
// loaded from disk under a CSP, so updates travel through files in
// src/main/build/hmr/<clientId>/, the way webpack's hot-update chunks used to:
//
//   client.json                  client -> dev.mjs: "this window is <clientId>"
//   <clientId>/<seq>.json        dev.mjs -> client: a patch or a full reload
//   <clientId>/<seq>.mjs         the patch, imported with import()
//   <clientId>/delivered.log     client -> dev.mjs: patches that ran
//
// A patch registers new module factories with the runtime. The client walks up
// from the changed modules to the nearest self-accepting modules (boundaries),
// evicts everything on the way, and re-runs the boundaries. React components get
// their boundaries from the refresh wrapper in dev.mjs; anything else that
// reaches an entry without a boundary reloads the window.
//
/* global DevRuntime */

/** @type {typeof import("rolldown/experimental/runtime").DevRuntime} */
// @ts-expect-error -- declared by rolldown's runtime, which dev.mjs puts ahead of this file
const BaseDevRuntime = DevRuntime;

const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");
const RefreshRuntime = require("react-refresh/runtime");

const LOG_PREFIX = "[vortex-hmr]";

// react-refresh has to hook React DevTools' global before react-dom loads, and
// every renderer module runs after this file.
RefreshRuntime.injectIntoGlobalHook(window);
// The refresh transform calls these globals in every module; the wrapper in
// dev.mjs points them at the module being run.
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;

const buildDir = path.dirname(fileURLToPath(import.meta.url));
const hmrDir = path.join(buildDir, "hmr");
const clientId = crypto.randomUUID();
const clientDir = path.join(hmrDir, clientId);

class HotContext {
  /**
   * @param {string} id
   * @param {Record<string, unknown>} data carried over from the previous run
   */
  constructor(id, data) {
    this.id = id;
    this.data = data;
    this.selfAccepted = false;
    this.registeredComponents = 0;
    /** @type {Array<(data: Record<string, unknown>) => void>} */
    this.disposeCallbacks = [];
  }

  /** @param {unknown} [deps] */
  accept(deps) {
    if (deps === undefined || typeof deps === "function") {
      this.selfAccepted = true;
    } else {
      // Accepting a dependency needs its specifier resolved to a module id,
      // which only the bundler knows. Nothing in Vortex does it; such a module
      // is treated as not accepting, so an update to it reloads the window.
      console.warn(`${LOG_PREFIX} ${this.id}: accepting dependencies is not supported`);
    }
  }

  /** @param {(data: Record<string, unknown>) => void} callback */
  dispose(callback) {
    this.disposeCallbacks.push(callback);
  }

  decline() {}

  /** @param {string} [message] */
  invalidate(message) {
    fullReload(`${this.id} invalidated itself${message ? `: ${message}` : ""}`);
  }

  // Called first thing in every renderer module by the React refresh wrapper
  // (see dev.mjs). The refresh transform puts the module's $RefreshReg$ calls
  // at the end of its body, so the globals stay pointed at this module until
  // the next module starts; there is no end-of-module hook to reset them.
  beginRefreshRegistration() {
    const id = this.id;
    window.$RefreshReg$ = (type, name) => {
      this.registeredComponents += 1;
      RefreshRuntime.register(type, `${id} ${name}`);
    };
    window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
  }

  /**
   * React refresh can swap a module in place when it registered function
   * components (the transform doesn't register class components) and exports
   * nothing but components. Decided when an update arrives, after the module
   * body and its registrations have run.
   */
  isRefreshBoundary() {
    return this.registeredComponents > 0 && isRefreshBoundary(runtime().loadExports(this.id));
  }

  accepts() {
    return this.selfAccepted || this.isRefreshBoundary();
  }
}

/** @param {Record<string, unknown>} exports */
function isRefreshBoundary(exports) {
  const names = Object.keys(exports);
  if (names.length === 0) return false;
  return names.every((name) => {
    const value = exports[name];
    return RefreshRuntime.isLikelyComponentType(value);
  });
}

class FileDevRuntime extends BaseDevRuntime {
  /** @type {Map<string, HotContext>} */
  hotContexts = new Map();
  /** @type {Map<string, Record<string, unknown>>} */
  hotData = new Map();

  /** @param {string} moduleId */
  createModuleHotContext(moduleId) {
    let data = this.hotData.get(moduleId);
    if (data === undefined) {
      data = {};
      this.hotData.set(moduleId, data);
    }
    const context = new HotContext(moduleId, data);
    this.hotContexts.set(moduleId, context);
    return context;
  }
}

// Every module in the bundle talks to the runtime through this global.
const devRuntime = new FileDevRuntime(clientId);
Reflect.set(globalThis, "__rolldown_runtime__", devRuntime);

function runtime() {
  return devRuntime;
}

let reloading = false;
/** @param {string} reason */
function fullReload(reason) {
  if (reloading) return;
  reloading = true;
  console.log(`${LOG_PREFIX} ${reason}, reloading window`);
  window.location.reload();
}

/**
 * Evicts every module between the changed ones and their boundaries, then
 * re-runs the boundaries. Returns false when the update can't be applied in
 * place and the window has to reload.
 * @param {string[]} changedIds
 */
function applyUpdate(changedIds) {
  const rt = runtime();
  const boundaries = new Set();
  const invalidated = new Set();
  const queue = changedIds.filter((id) => rt.isExecuted(id));

  for (const id of queue) {
    if (invalidated.has(id)) continue;
    invalidated.add(id);
    if (rt.hotContexts.get(id)?.accepts()) {
      boundaries.add(id);
      continue;
    }
    const importers = rt.getImporters(id).filter((importer) => rt.isExecuted(importer));
    if (rt.isEntry(id) || importers.length === 0) {
      fullReload(`${id} has no HMR boundary`);
      return false;
    }
    queue.push(...importers);
  }

  if (boundaries.size === 0) return true; // nothing that changed has run yet

  for (const id of invalidated) {
    if (!rt.hasFactory(id)) {
      fullReload(`no update for ${id}`);
      return false;
    }
  }

  for (const id of invalidated) {
    const context = rt.hotContexts.get(id);
    if (context === undefined) continue;
    for (const callback of context.disposeCallbacks) callback(context.data);
  }
  for (const id of invalidated) rt.removeModuleCache(id);

  try {
    for (const id of boundaries) rt.initModule(id);
  } catch (err) {
    console.error(`${LOG_PREFIX} update failed`, err);
    fullReload("update threw");
    return false;
  }

  // A boundary has to accept its own new version too. A component module that
  // gained a non-component export can't be swapped in place any more.
  for (const id of boundaries) {
    if (!rt.hotContexts.get(id)?.accepts()) {
      fullReload(`${id} can no longer be updated in place`);
      return false;
    }
  }

  RefreshRuntime.performReactRefresh();
  console.log(`${LOG_PREFIX} updated ${[...boundaries].join(", ")}`);
  return true;
}

let nextSeq = 0;
/** @type {Map<number, { type: string, file?: string, filename?: string, changedIds?: string[], reason?: string }>} */
const pending = new Map();
let draining = false;

async function drain() {
  if (draining) return;
  draining = true;
  try {
    // Updates apply in sequence order; a gap waits for the missing one.
    for (let update = pending.get(nextSeq); update !== undefined; update = pending.get(nextSeq)) {
      pending.delete(nextSeq);
      nextSeq += 1;
      if (update.type === "reload") {
        fullReload(update.reason ?? "full reload requested");
        return;
      }
      // oxlint-disable-next-line no-await-in-loop -- patches build on each other and must apply in order
      await import(pathToFileURL(path.join(clientDir, update.file ?? "")).href);
      fs.appendFileSync(path.join(clientDir, "delivered.log"), `${update.filename}\n`);
      if (!applyUpdate(update.changedIds ?? [])) return;
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} could not load update`, err);
    fullReload("update failed to load");
  } finally {
    draining = false;
  }
}

/** @param {string} file */
function readNotice(file) {
  const match = /^(\d+)\.json$/.exec(file);
  if (match === null) return;
  const seq = Number(match[1]);
  if (seq < nextSeq || pending.has(seq)) return;
  try {
    pending.set(seq, JSON.parse(fs.readFileSync(path.join(clientDir, file), "utf8")));
  } catch {
    return; // still being written; the next watch event picks it up
  }
  void drain();
}

function watchStylesheets() {
  const cssDir = path.join(buildDir, "assets", "css");
  try {
    fs.watch(cssDir, (/** @type {string} */ _, /** @type {string | null} */ file) => {
      if (file == null || !file.endsWith(".css")) return;
      for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        const href = (link.getAttribute("href") ?? "").split("?")[0];
        if (href.endsWith(`/${file}`) || href === `assets/css/${file}`) {
          link.setAttribute("href", `${href}?v=${Date.now()}`);
          console.log(`${LOG_PREFIX} swapped stylesheet ${file}`);
        }
      }
    });
  } catch (err) {
    console.warn(`${LOG_PREFIX} css watch unavailable`, err);
  }
}

fs.mkdirSync(clientDir, { recursive: true });
fs.watch(clientDir, (/** @type {string} */ _, /** @type {string | null} */ file) => {
  if (file != null) readNotice(file);
});
fs.writeFileSync(path.join(hmrDir, "client.json"), JSON.stringify({ clientId }));
watchStylesheets();
console.log(`${LOG_PREFIX} ready (${clientId})`);
