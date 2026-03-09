//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) {
				__defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
		}
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
let bluebird = require("bluebird");
bluebird = __toESM(bluebird);
let path = require("path");
path = __toESM(path);
let vortex_api = require("vortex-api");
let semver = require("semver");
semver = __toESM(semver);

//#region extensions/games/game-untitledgoose/statics.ts
const DATAPATH = path.default.join("Untitled_Data", "Managed");
const EPIC_APP_ID = "Flour";
const GAME_ID = "untitledgoosegame";

//#endregion
//#region extensions/games/game-untitledgoose/util.ts
function toBlue(func) {
	return (...args) => bluebird.default.resolve(func(...args));
}
function getDiscoveryPath(state) {
	const discovery = vortex_api.util.getSafe(state, [
		"settings",
		"gameMode",
		"discovered",
		GAME_ID
	], void 0);
	if (discovery === void 0 || discovery.path === void 0) {
		(0, vortex_api.log)("debug", "untitledgoosegame was not discovered");
		return;
	}
	return discovery.path;
}

//#endregion
//#region extensions/games/game-untitledgoose/migrations.ts
function migrate020(context, oldVersion) {
	if (semver.default.gte(oldVersion, "0.2.0")) return Promise.resolve();
	const discoveryPath = getDiscoveryPath(context.api.getState());
	if (discoveryPath === void 0) return Promise.resolve();
	const modsPath = path.default.join(discoveryPath, DATAPATH, "VortexMods");
	return context.api.awaitUI().then(() => vortex_api.fs.ensureDirWritableAsync(modsPath)).then(() => context.api.emitAndAwait("purge-mods-in-path", GAME_ID, "", modsPath));
}

//#endregion
//#region extensions/games/game-untitledgoose/index.ts
const BIX_CONFIG = "BepInEx.cfg";
function ensureBIXConfig(discovery) {
	const src = path.default.join(__dirname, BIX_CONFIG);
	const dest = path.default.join(discovery.path, "BepInEx", "config", BIX_CONFIG);
	return vortex_api.fs.ensureDirWritableAsync(path.default.dirname(dest)).then(() => vortex_api.fs.copyAsync(src, dest)).catch((err) => {
		if (err.code !== "EEXIST") (0, vortex_api.log)("warn", "failed to write BIX config", err);
		return bluebird.default.resolve();
	});
}
function requiresLauncher() {
	return vortex_api.util.epicGamesLauncher.isGameInstalled(EPIC_APP_ID).then((epic) => epic ? {
		launcher: "epic",
		addInfo: EPIC_APP_ID
	} : void 0);
}
function findGame() {
	return vortex_api.util.epicGamesLauncher.findByAppId(EPIC_APP_ID).then((epicEntry) => epicEntry.gamePath);
}
function modPath() {
	return path.default.join("BepInEx", "plugins");
}
function prepareForModding(discovery) {
	if (discovery?.path === void 0) return bluebird.default.reject(new vortex_api.util.ProcessCanceled("Game not discovered"));
	return ensureBIXConfig(discovery).then(() => vortex_api.fs.ensureDirWritableAsync(path.default.join(discovery.path, "BepInEx", "plugins")));
}
function main(context) {
	context.registerGame({
		id: GAME_ID,
		name: "Untitled Goose Game",
		mergeMods: true,
		queryPath: findGame,
		queryModPath: modPath,
		requiresLauncher,
		logo: "gameart.jpg",
		executable: () => "Untitled.exe",
		requiredFiles: ["Untitled.exe", "UnityPlayer.dll"],
		setup: prepareForModding
	});
	context.registerMigration(toBlue((old) => migrate020(context, old)));
	context.once(() => {
		if (context.api.ext.bepinexAddGame !== void 0) context.api.ext.bepinexAddGame({
			gameId: GAME_ID,
			autoDownloadBepInEx: true,
			doorstopConfig: {
				doorstopType: "default",
				ignoreDisableSwitch: true
			}
		});
	});
	return true;
}
module.exports = { default: main };

//#endregion
//# sourceMappingURL=index.js.map