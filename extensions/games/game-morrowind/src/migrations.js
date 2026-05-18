const path = require("path");
const semver = require("semver");
const { actions, log, selectors, util } = require("vortex-api");
const { MORROWIND_ID } = require("./constants");

const walk = require("turbowalk").default;

async function migrate103(api, oldVersion) {
  if (semver.gte(oldVersion, "1.0.3")) {
    return Promise.resolve();
  }

  const state = api.getState();
  const installPath = selectors.installPathForGame(state, MORROWIND_ID);
  const mods = util.getSafe(state, ["persistent", "mods", MORROWIND_ID], {});
  if (installPath === undefined || Object.keys(mods).length === 0) {
    return Promise.resolve();
  }

  const batched = [];
  for (const mod of Object.values(mods)) {
    if (mod?.installationPath === undefined) {
      continue;
    }
    const modPath = path.join(installPath, mod.installationPath);
    const plugins = [];
    try {
      await walk(
        modPath,
        (entries) => {
          for (let entry of entries) {
            if ([".esp", ".esm"].includes(path.extname(entry.filePath.toLowerCase()))) {
              plugins.push(path.basename(entry.filePath));
            }
          }
        },
        { recurse: true, skipLinks: true, skipInaccessible: true },
      );
    } catch {
      // don't know, don't care, just skip it
      log("warn", "morrowind migrate103: mod directory missing or inaccessible, skipping", {
        modPath,
      });
      continue;
    }
    if (plugins.length > 0) {
      batched.push(actions.setModAttribute(MORROWIND_ID, mod.id, "plugins", plugins));
    }
  }

  if (batched.length > 0 && util.batchDispatch !== undefined) {
    util.batchDispatch(api.store, batched);
  } else {
    for (const action of batched) {
      api.store.dispatch(action);
    }
  }
  return Promise.resolve();
}

module.exports = {
  migrate103,
};
