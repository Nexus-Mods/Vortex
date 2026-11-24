// Checks that what the live-test helpers take from the Vortex source is still there: the action
// types attach.js dispatches by name, the events and api calls it uses, and the labels the docs
// click. A rename in the app otherwise only shows as a helper that silently does nothing.
//
// Usage: node .claude/skills/live-test/scripts/drift-check.mjs
// Exits 1 and lists what is missing. Add a marker here when a helper starts using a new one.
import { spawnSync } from "node:child_process";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "..", "..", "..", "..");

// [literal as it appears in the source, what uses it]
const markers = [
  ['"ADD_DISCOVERED_GAME"', "attach.js useGameFolder"],
  ['"UNDISCOVER_GAME"', "attach.js useGameFolder, forgetFakeGame"],
  ['"SET_ACTIVATOR"', "attach.js unmanage"],
  ['"hardlink_activator"', "attach.js unmanage"],
  ['"activate-game"', "attach.js activateGame"],
  ['"remove-download"', "attach.js forgetFakeGame"],
  ['"unmanageGame"', "attach.js unmanage (api.ext.unmanageGame)"],
  ['"start-install-download"', "SKILL.md, swallowing an install"],
  ["__vortex_staging_folder", "attach.js removeIfEmpty"],
  ['"{USERDATA}"', "attach.js profileFolders"],
  ['"Delete profiles"', "fake-game.md, the stop-managing dialog"],
  ["getPath: (name: string) => string", "attach.js userData (api.getPath)"],
  ["known: IGameStored[]", "attach.js games, gameInfo (session.gameMode.known)"],
  ["requiredFiles: string[]", "attach.js createFakeGame"],
  ["dialogs: IDialog[]", "attach.js summary (session.notifications.dialogs)"],
  ["pathSetManually", "attach.js useGameFolder"],
  [
    "activeProfileId: string",
    "attach.js summary, activateGame (settings.profiles.activeProfileId)",
  ],
];

const missing = [];
for (const [literal, user] of markers) {
  const args = [
    "grep",
    "-qF",
    "--untracked",
    literal,
    "--",
    "src",
    "extensions",
    "packages",
    ":(exclude,glob)**/*.test.*",
    ":(exclude,glob)**/*.spec.*",
  ];
  const result = spawnSync("git", args, { cwd: repo, stdio: "ignore" });
  if (result.status !== 0) missing.push(`  ${literal}   (${user})`);
}

if (missing.length > 0) {
  console.error(`MISSING from the source, ${missing.length} of ${markers.length}:`);
  console.error(missing.join("\n"));
  process.exit(1);
}
console.log(`live-test drift-check: all ${markers.length} markers found`);
