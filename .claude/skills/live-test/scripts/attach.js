// Pass this whole file as the `function` of the chrome-devtools `evaluate_script` tool.
// It installs `window.__vortexLive` in the Vortex window and returns a summary of the app's state.
// Later calls are one-liners, e.g. `() => window.__vortexLive.fakeGame("skyrimse")`.
// The handle is lost when the window reloads (every HMR reload does that): attach again.
() => {
  // Vortex exposes no global for its store or extension api, so find them in React's internals.
  const roots = [];
  for (const el of document.querySelectorAll("body, body *")) {
    const key = Object.keys(el).find((k) => k.startsWith("__reactContainer$"));
    if (key) roots.push(el[key]);
  }
  let store;
  let api;
  const stack = roots.map((root) => root.stateNode?.current ?? root);
  while (stack.length > 0 && (!store || !api)) {
    const fiber = stack.pop();
    const props = fiber.memoizedProps;
    if (!store && props?.store?.getState && props.store.dispatch) store = props.store;
    for (const c of [props?.value, props, fiber.stateNode?.context, fiber.stateNode?.props]) {
      if (api) break;
      if (c?.api?.events?.emit && c.api.getState) api = c.api;
      else if (c?.events?.emit && c?.getState && c?.sendNotification) api = c;
    }
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
  }
  if (!store || !api) {
    // thrown, not returned, so an `until:` step keeps trying while the window is still loading
    throw new Error("store or api not found: is the main window loaded (not the splash screen)?");
  }

  const fs = window.require("fs");
  const path = window.require("path");
  const os = window.require("os");

  // Smallest file Vortex accepts as a Windows executable: DOS stub, PE signature, x64 machine type.
  const fakeExecutable = () => {
    const buffer = Buffer.alloc(512);
    buffer.write("MZ", 0);
    buffer.writeUInt32LE(0x40, 0x3c);
    buffer.write("PE\0\0", 0x40);
    buffer.writeUInt16LE(0x8664, 0x44);
    return buffer;
  };

  const knownGame = (gameId) => {
    const game = store.getState().session.gameMode.known.find((g) => g.id === gameId);
    if (!game) throw new Error(`"${gameId}" is not a game this Vortex knows (see games())`);
    return game;
  };

  // The profile folder of the running app, as the app itself reports it: the default location, or
  // the one given with --user-data.
  const userData = () => {
    try {
      return api.getPath("userData") || undefined;
    } catch {
      return undefined;
    }
  };

  // createFakeGame leaves this file in the folder it makes. A folder is only treated as fake, and
  // only ever deleted, when the file is in it.
  const fakeMarker = ".vortex-live-test";
  const isFake = (gamePath) =>
    typeof gamePath === "string" && fs.existsSync(path.join(gamePath, fakeMarker));
  const hasProfiles = (gameId) =>
    Object.values(store.getState().persistent.profiles ?? {}).some((p) => p.gameId === gameId);

  // Where Vortex keeps a game's staged mods and its downloads (the defaults of getInstallPath and
  // getDownloadPath, or the user's own setting).
  const profileFolders = (gameId) => {
    const s = store.getState();
    const base = userData();
    const fill = (pattern) =>
      pattern
        .replace(/\{userdata\}/gi, base ?? "{USERDATA}")
        .replace(/\{game\}/gi, gameId)
        .replace(/\{username\}/gi, os.userInfo().username);
    const stagingPattern = s.settings.mods.installPath?.[gameId];
    const defaultGameDir = fill(path.join("{USERDATA}", "{GAME}"));
    const configuredStaging = stagingPattern ? fill(stagingPattern) : defaultGameDir;
    return {
      // by default the staging folder is <profile>/<game>/mods, and <profile>/<game> holds nothing else
      staging:
        path.dirname(configuredStaging) === defaultGameDir ? defaultGameDir : configuredStaging,
      downloads: path.join(
        fill(s.settings.downloads.path || path.join("{USERDATA}", "downloads")),
        gameId,
      ),
    };
  };

  // Deletes a folder only when nothing is left in it but empty folders and Vortex's own marker.
  const removeIfEmpty = (dir) => {
    if (!path.isAbsolute(dir) || dir.includes("{")) return "not resolved: check by hand";
    if (!fs.existsSync(dir)) return "absent";
    const hasFiles = (d) =>
      fs
        .readdirSync(d, { withFileTypes: true })
        .some((e) =>
          e.isDirectory() ? hasFiles(path.join(d, e.name)) : e.name !== "__vortex_staging_folder",
        );
    if (hasFiles(dir)) return "kept: still has files";
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 });
    return "removed";
  };

  const baselineFile = path.join(os.tmpdir(), "vortex-live-test", "baseline.json");
  // What baseline() recorded, or undefined when it was never called.
  const readBaseline = () =>
    fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, "utf8")) : undefined;
  const inventory = () => {
    const s = store.getState();
    return {
      mods: Object.entries(s.persistent.mods ?? {}).flatMap(([gameId, mods]) =>
        Object.keys(mods).map((modId) => `${gameId}/${modId}`),
      ),
      downloads: Object.keys(s.persistent.downloads.files ?? {}),
      profiles: Object.keys(s.persistent.profiles ?? {}),
      games: Object.entries(s.settings.gameMode.discovered ?? {})
        .filter(([, d]) => d.path)
        .map(([id]) => id),
    };
  };

  const live = {
    store,
    api,
    state: () => store.getState(),

    summary() {
      const s = store.getState();
      const profile = s.persistent.profiles[s.settings.profiles.activeProfileId];
      return {
        userData: userData() ?? null,
        user: s.persistent.nexus?.userInfo?.name ?? null,
        premium: s.persistent.nexus?.userInfo?.isPremium ?? null,
        activeGame: profile?.gameId ?? null,
        activeProfile: profile ? `${profile.id} ${profile.name}` : null,
        discovered: Object.fromEntries(
          Object.entries(s.settings.gameMode.discovered ?? {})
            .filter(([, d]) => d.path)
            .map(([id, d]) => [id, d.path]),
        ),
        profiles: Object.values(s.persistent.profiles).map((p) => `${p.id} ${p.gameId} ${p.name}`),
        knownGames: s.session.gameMode.known.length,
        dialogs: (s.session.notifications.dialogs ?? []).map((d) => d.title),
      };
    },

    /** Ids and names of every game this Vortex has an extension for, optionally filtered. */
    games(filter) {
      const needle = (filter ?? "").toLowerCase();
      return store
        .getState()
        .session.gameMode.known.filter(
          (g) => g.id.includes(needle) || g.name.toLowerCase().includes(needle),
        )
        .map((g) => `${g.id}: ${g.name}`);
    },

    /** What the game's extension declared (the stored form of its IGame). */
    gameInfo(gameId) {
      const game = knownGame(gameId);
      return {
        id: game.id,
        name: game.name,
        executable: game.executable,
        requiredFiles: game.requiredFiles,
        tools: (game.supportedTools ?? []).map((t) => `${t.id}: ${t.executable}`),
        details: game.details,
        extensionPath: game.extensionPath,
      };
    },

    /**
     * Creates a folder that passes as an install of the game: every `requiredFiles` entry and the
     * executable, plus `extra` (relative paths; one ending in "/" is a directory, and an object
     * `{ path, content }` writes that content). Returns the folder.
     */
    createFakeGame(gameId, options = {}) {
      const game = knownGame(gameId);
      const root = options.root ?? path.join(os.tmpdir(), "vortex-live-test", "games");
      const gamePath = path.join(root, game.name.replace(/[<>:"/\\|?*]/g, ""));
      // A folder that is already there without the marker isn't ours (with `root`, it may be a
      // real install): marking it would let forgetFakeGame delete it.
      if (fs.existsSync(gamePath) && !isFake(gamePath)) {
        throw new Error(
          `${gamePath} already exists and wasn't made by createFakeGame: ` +
            `remove it by hand if it is a leftover, or pass another root`,
        );
      }
      fs.mkdirSync(gamePath, { recursive: true });
      fs.writeFileSync(path.join(gamePath, fakeMarker), "");
      const entries = [...new Set([...(game.requiredFiles ?? []), game.executable])]
        .filter(Boolean)
        .concat(options.extra ?? []);
      const created = [];
      for (const entry of entries) {
        const rel = typeof entry === "string" ? entry : entry.path;
        const target = path.join(gamePath, rel);
        if (rel.endsWith("/") || rel.endsWith("\\")) {
          fs.mkdirSync(target, { recursive: true });
        } else {
          fs.mkdirSync(path.dirname(target), { recursive: true });
          if (typeof entry !== "string" && entry.content !== undefined) {
            fs.writeFileSync(target, entry.content);
          } else if (!fs.existsSync(target)) {
            fs.writeFileSync(target, /\.exe$/i.test(rel) ? fakeExecutable() : "");
          }
        }
        created.push(rel);
      }
      return { gamePath, created };
    },

    /**
     * Tells Vortex the game is installed at `gamePath`, the way picking the folder by hand does
     * once the folder passed the requiredFiles check (which is repeated here). A game that is
     * managed with a real install is refused: stop managing it first, so its mods are purged out
     * of the real folder, then manage the fake one.
     */
    useGameFolder(gameId, gamePath) {
      const game = knownGame(gameId);
      const missing = (game.requiredFiles ?? []).filter(
        (file) => !fs.existsSync(path.join(gamePath, file)),
      );
      if (missing.length > 0) {
        throw new Error(`${gamePath} is missing required files: ${missing.join(", ")}`);
      }
      const existing = store.getState().settings.gameMode.discovered?.[gameId];
      if (existing?.path !== undefined && !isFake(existing.path) && hasProfiles(gameId)) {
        throw new Error(
          `${gameId} is managed with a real install at ${existing.path}: stop managing it first ` +
            `(unmanage("${gameId}"), then "Delete profiles"), then call fakeGame again`,
        );
      }
      // An unmanaged game's old location is dropped, not edited: the fake one starts clean.
      if (existing?.path !== undefined) {
        store.dispatch({ type: "UNDISCOVER_GAME", payload: { id: gameId } });
      }
      store.dispatch({
        type: "ADD_DISCOVERED_GAME",
        payload: {
          id: gameId,
          result: {
            path: gamePath,
            tools: {},
            hidden: false,
            environment: game.environment,
            pathSetManually: true,
          },
        },
      });
      return {
        gameId,
        path: store.getState().settings.gameMode.discovered[gameId].path,
        replaced: existing?.path ?? null,
      };
    },

    /** createFakeGame + useGameFolder. The game still has to be managed (see the skill). */
    fakeGame(gameId, options = {}) {
      const { gamePath, created } = live.createFakeGame(gameId, options);
      return { ...live.useGameFolder(gameId, gamePath), created };
    },

    /** Sizes the window, so captures are the same size every time. Returns the page size. */
    async resize(width = 1280, height = 800) {
      window.resizeTo(width, height);
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { width: window.innerWidth, height: window.innerHeight };
    },

    /**
     * Switches to a game that already has a profile. Resolves with the summary once it is the
     * active game, and throws if it isn't by the timeout.
     */
    async activateGame(gameId, timeoutMs = 120000) {
      const active = () => {
        const s = store.getState();
        return s.persistent.profiles[s.settings.profiles.activeProfileId]?.gameId;
      };
      api.events.emit("activate-game", gameId);
      const deadline = Date.now() + timeoutMs;
      while (active() !== gameId) {
        if (Date.now() > deadline) {
          throw new Error(
            `activateGame: "${gameId}" is not the active game after ${timeoutMs} ms ` +
              `(active: ${active() ?? "none"}, dialogs: ${JSON.stringify(live.summary().dialogs)})`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      return live.summary();
    },

    /**
     * Records what the dev profile holds now (mods, downloads, profiles, game locations), in a
     * file, so it survives reloads. Take it before the first scenario; `changes()` compares.
     */
    baseline() {
      const taken = inventory();
      fs.mkdirSync(path.dirname(baselineFile), { recursive: true });
      fs.writeFileSync(baselineFile, JSON.stringify(taken));
      return Object.fromEntries(Object.entries(taken).map(([kind, ids]) => [kind, ids.length]));
    },

    /**
     * What the profile gained and lost since `baseline()`. Anything a scenario didn't mean to add
     * is a stray click: stop and remove it. Compares ids only (which mods, downloads, profiles and
     * game locations exist): empty means nothing was added or removed, not that nothing changed.
     * A mod's state, a setting, or a game's path can differ and not show here.
     */
    changes() {
      const before = readBaseline();
      if (before === undefined) throw new Error("no baseline: call baseline() first");
      const now = inventory();
      const s = store.getState();
      const label = {
        mods: (key) => key,
        downloads: (id) => `${id} ${s.persistent.downloads.files[id]?.localPath ?? ""}`.trim(),
        profiles: (id) => {
          const p = s.persistent.profiles[id];
          return p ? `${id} ${p.gameId} ${p.name}` : id;
        },
        games: (id) => id,
      };
      const result = {};
      for (const kind of Object.keys(now)) {
        const added = now[kind].filter((id) => !before[kind].includes(id)).map(label[kind]);
        const removed = before[kind].filter((id) => !now[kind].includes(id));
        if (added.length > 0) result[`${kind} added`] = added;
        if (removed.length > 0) result[`${kind} removed`] = removed;
      }
      return result;
    },

    /**
     * Starts "Stop managing" for the game. Vortex asks for confirmation: click "Delete profiles",
     * then call forgetFakeGame. Doesn't wait, so the dialog can be answered.
     */
    unmanage(gameId) {
      // A game whose mod folders didn't all exist when it was first activated has no deployment
      // method stored, and then stop-managing can't purge ("Failed to purge"). Store the default.
      const s = store.getState();
      if (s.settings.mods.activator?.[gameId] === undefined) {
        store.dispatch({
          type: "SET_ACTIVATOR",
          payload: { gameId, activatorId: "hardlink_activator" },
        });
      }
      void api.ext.unmanageGame(gameId);
      return "confirm with the 'Delete profiles' button, then forgetFakeGame";
    },

    /**
     * Drops the fake game's location, removes the game's downloads that were added since
     * `baseline()`, deletes the fake folder, and removes the game's staging and downloads folders
     * from the profile once they are empty. Downloads that were there at the baseline are the
     * user's and stay; without a baseline there is no telling them apart, so all of them stay.
     * Refuses a game that has no location or whose location isn't a fake folder, so it can't be
     * run twice. Read the result: anything not "removed" or "absent" is left for you.
     */
    async forgetFakeGame(gameId) {
      const s = store.getState();
      if (hasProfiles(gameId)) {
        throw new Error(`${gameId} still has profiles: unmanage it first`);
      }
      const gamePath = s.settings.gameMode.discovered?.[gameId]?.path;
      // Without a location there is no fake game to forget: a mistyped id, a game that was never
      // faked, or a second call. Going on would only remove the game's downloads.
      if (gamePath === undefined) {
        throw new Error(`${gameId} has no fake folder: nothing to forget`);
      }
      if (!isFake(gamePath)) {
        throw new Error(`${gameId} is at ${gamePath}, which is not a fake folder: left alone`);
      }
      const folders = profileFolders(gameId);
      const ofGame = Object.entries(s.persistent.downloads.files ?? {})
        .filter(([, d]) => d.game?.[0] === gameId)
        .map(([id]) => id);
      const before = readBaseline()?.downloads;
      const downloads = before === undefined ? [] : ofGame.filter((id) => !before.includes(id));
      const downloadsKept = ofGame.filter((id) => !downloads.includes(id));
      for (const id of downloads) {
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 15000);
          api.events.emit("remove-download", id, () => {
            clearTimeout(timer);
            resolve();
          });
        });
      }
      const downloadsLeft = downloads.filter(
        (id) => store.getState().persistent.downloads.files?.[id] !== undefined,
      );
      store.dispatch({ type: "UNDISCOVER_GAME", payload: { id: gameId } });
      fs.rmSync(gamePath, { recursive: true, force: true, maxRetries: 10 });
      return {
        gameId,
        gamePath,
        removed: true,
        downloadsRemoved: downloads.length - downloadsLeft.length,
        downloadsLeft,
        downloadsKept:
          before === undefined && downloadsKept.length > 0
            ? `${downloadsKept.length}: no baseline() was taken, so none were removed`
            : `${downloadsKept.length} from before the baseline`,
        stagingFolder: `${folders.staging}: ${removeIfEmpty(folders.staging)}`,
        downloadsFolder: `${folders.downloads}: ${removeIfEmpty(folders.downloads)}`,
      };
    },

    /** Waits until `predicate(state)` is truthy and returns its value, or throws on timeout. */
    async waitFor(predicate, timeoutMs = 60000) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const value = predicate(store.getState());
        if (value) return value;
        if (Date.now() > deadline) throw new Error("waitFor timed out");
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    },
  };

  window.__vortexLive = live;
  return live.summary();
};
