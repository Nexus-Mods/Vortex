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
let turbowalk = require("turbowalk");
turbowalk = __toESM(turbowalk);
let semver = require("semver");
semver = __toESM(semver);

//#region extensions/games/game-codevein/common.ts
const MOD_FILE_EXT = ".pak";
const GAME_ID = "codevein";
const LO_FILE_NAME = "loadOrder.json";
function modsRelPath() {
	return path.default.join("CodeVein", "content", "paks", "~mods");
}

//#endregion
//#region extensions/games/game-codevein/util.ts
function toBlue(func) {
	return (...args) => bluebird.default.resolve(func(...args));
}
function genProps(context, profileId) {
	const api = context.api;
	const state = api.getState();
	const profile = profileId !== void 0 ? vortex_api.selectors.profileById(state, profileId) : vortex_api.selectors.activeProfile(state);
	if (profile?.gameId !== GAME_ID) return;
	const discovery = vortex_api.util.getSafe(state, [
		"settings",
		"gameMode",
		"discovered",
		GAME_ID
	], void 0);
	if (discovery?.path === void 0) return;
	return {
		api,
		state,
		profile,
		mods: vortex_api.util.getSafe(state, [
			"persistent",
			"mods",
			GAME_ID
		], {}),
		discovery
	};
}
async function ensureLOFile(context, profileId, props) {
	if (props === void 0) props = genProps(context, profileId);
	if (props === void 0) return Promise.reject(new vortex_api.util.ProcessCanceled("failed to generate game props"));
	const targetPath = path.default.join(props.discovery.path, props.profile.id + "_" + LO_FILE_NAME);
	try {
		await vortex_api.fs.statAsync(targetPath).catch({ code: "ENOENT" }, () => vortex_api.fs.writeFileAsync(targetPath, JSON.stringify([]), { encoding: "utf8" }));
		return targetPath;
	} catch (err) {
		return Promise.reject(err);
	}
}
function makePrefix(input) {
	let res = "";
	let rest = input;
	while (rest > 0) {
		res = String.fromCharCode(65 + rest % 25) + res;
		rest = Math.floor(rest / 25);
	}
	return vortex_api.util.pad(res, "A", 3);
}
async function getPakFiles(basePath) {
	let filePaths = [];
	return (0, turbowalk.default)(basePath, (files) => {
		const filtered = files.filter((entry) => !entry.isDirectory && path.default.extname(entry.filePath) === MOD_FILE_EXT);
		filePaths = filePaths.concat(filtered.map((entry) => entry.filePath));
	}, {
		recurse: true,
		skipLinks: true
	}).catch((err) => ["ENOENT", "ENOTFOUND"].includes(err.code) ? Promise.resolve() : Promise.reject(err)).then(() => Promise.resolve(filePaths));
}

//#endregion
//#region extensions/games/game-codevein/loadOrder.ts
async function serialize(context, loadOrder, profileId) {
	const props = genProps(context);
	if (props === void 0) return Promise.reject(new vortex_api.util.ProcessCanceled("invalid props"));
	const loFilePath = await ensureLOFile(context, profileId, props);
	const prefixedLO = loadOrder.filter((lo) => props.mods?.[lo?.modId]?.type !== "collection").map((loEntry, idx) => {
		const data = { prefix: makePrefix(idx) };
		return {
			...loEntry,
			data
		};
	});
	await vortex_api.fs.removeAsync(loFilePath).catch({ code: "ENOENT" }, () => Promise.resolve());
	await vortex_api.fs.writeFileAsync(loFilePath, JSON.stringify(prefixedLO), { encoding: "utf8" });
	return Promise.resolve();
}
async function deserialize(context) {
	const props = genProps(context);
	if (props?.profile?.gameId !== GAME_ID) return [];
	const currentModsState = vortex_api.util.getSafe(props.profile, ["modState"], {});
	const enabledModIds = Object.keys(currentModsState).filter((modId) => vortex_api.util.getSafe(currentModsState, [modId, "enabled"], false));
	const mods = vortex_api.util.getSafe(props.state, [
		"persistent",
		"mods",
		GAME_ID
	], {});
	const loFilePath = await ensureLOFile(context);
	const fileData = await vortex_api.fs.readFileAsync(loFilePath, { encoding: "utf8" });
	try {
		const filteredData = JSON.parse(fileData).filter((entry) => enabledModIds.includes(entry.id));
		enabledModIds.filter((id) => mods[id]?.type !== "collection" && filteredData.find((loEntry) => loEntry.id === id) === void 0).forEach((missingEntry) => {
			filteredData.push({
				id: missingEntry,
				modId: missingEntry,
				enabled: true,
				name: mods[missingEntry] !== void 0 ? vortex_api.util.renderModName(mods[missingEntry]) : missingEntry
			});
		});
		return filteredData;
	} catch (err) {
		return Promise.reject(err);
	}
}
async function validate(prev, current) {}

//#endregion
//#region extensions/games/game-codevein/migrations.ts
async function migrate100(context, oldVersion) {
	if (semver.default.gte(oldVersion, "1.0.0")) return Promise.resolve();
	const state = context.api.store.getState();
	const activatorId = vortex_api.selectors.activatorForGame(state, GAME_ID);
	const activator = vortex_api.util.getActivator(activatorId);
	const discoveryPath = vortex_api.util.getSafe(state, [
		"settings",
		"gameMode",
		"discovered",
		GAME_ID,
		"path"
	], void 0);
	if (discoveryPath === void 0 || activator === void 0) return Promise.resolve();
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID
	], {});
	if (Object.keys(mods).length === 0) return Promise.resolve();
	const profiles = vortex_api.util.getSafe(state, ["persistent", "profiles"], {});
	const loMap = Object.keys(profiles).filter((id) => profiles[id]?.gameId === GAME_ID).reduce((accum, iter) => {
		accum[iter] = vortex_api.util.getSafe(state, [
			"persistent",
			"loadOrder",
			iter
		], []).map((entry) => {
			return {
				enabled: true,
				name: mods[entry] !== void 0 ? vortex_api.util.renderModName(mods[entry]) : entry,
				id: entry,
				modId: entry
			};
		});
		return accum;
	}, {});
	for (const profileId of Object.keys(loMap)) await serialize(context, loMap[profileId], profileId);
	const modsPath = path.default.join(discoveryPath, modsRelPath());
	return context.api.awaitUI().then(() => vortex_api.fs.ensureDirWritableAsync(modsPath)).then(() => context.api.emitAndAwait("purge-mods-in-path", GAME_ID, "", modsPath)).then(() => context.api.store.dispatch(vortex_api.actions.setDeploymentNecessary(GAME_ID, true)));
}

//#endregion
//#region extensions/games/game-codevein/index.ts
const STEAM_ID = "678960";
async function findGame() {
	return vortex_api.util.GameStoreHelper.findByAppId([STEAM_ID]).then((game) => game.gamePath);
}
async function externalFilesWarning(api, externalMods) {
	const t = api.translate;
	if (externalMods.length === 0) return Promise.resolve(void 0);
	return new Promise((resolve, reject) => {
		api.showDialog("info", "External Mod Files Detected", { bbcode: t("Vortex has discovered the following unmanaged/external files in the the game's mods directory:[br][/br][br][/br]{{files}}[br][/br]Please note that the existence of these mods interferes with Vortex's load ordering functionality and as such, they should be removed using the same medium through which they have been added.[br][/br][br][/br]Alternatively, Vortex can try to import these files into its mods list which will allow Vortex to take control over them and display them inside the load ordering page. Vortex's load ordering functionality will not display external mod entries unless imported!", { replace: { files: externalMods.map((mod) => `"${mod}"`).join("[br][/br]") } }) }, [{
			label: "Close",
			action: () => reject(new vortex_api.util.UserCanceled())
		}, {
			label: "Import External Mods",
			action: () => resolve(void 0)
		}]);
	});
}
async function ImportExternalMods(api, external) {
	const state = api.getState();
	const downloadsPath = vortex_api.selectors.downloadPathForGame(state, GAME_ID);
	const szip = new vortex_api.util.SevenZip();
	for (const modFile of external) {
		const archivePath = path.default.join(downloadsPath, path.default.basename(modFile, MOD_FILE_EXT) + ".zip");
		try {
			await szip.add(archivePath, [modFile], { raw: ["-r"] });
			await vortex_api.fs.removeAsync(modFile);
		} catch (err) {
			return Promise.reject(err);
		}
	}
}
async function prepareForModding(context, discovery) {
	const state = context.api.getState();
	const modsPath = path.default.join(discovery.path, modsRelPath());
	try {
		await vortex_api.fs.ensureDirWritableAsync(modsPath);
		const managedFiles = await getPakFiles(vortex_api.selectors.installPathForGame(state, GAME_ID));
		const deployedFiles = await getPakFiles(modsPath);
		const modifier = (filePath) => path.default.basename(filePath).toLowerCase();
		const unManagedPredicate = (filePath) => managedFiles.find((managed) => modifier(managed) === modifier(filePath)) === void 0;
		const externalMods = deployedFiles.filter(unManagedPredicate);
		try {
			await externalFilesWarning(context.api, externalMods);
			await ImportExternalMods(context.api, externalMods);
		} catch (err) {
			if (err instanceof vortex_api.util.UserCanceled) {} else return Promise.reject(err);
		}
	} catch (err) {
		return Promise.reject(err);
	}
}
function installContent(files) {
	const modFile = files.find((file) => path.default.extname(file).toLowerCase() === MOD_FILE_EXT);
	const idx = modFile.indexOf(path.default.basename(modFile));
	const rootPath = path.default.dirname(modFile);
	const instructions = files.filter((file) => file.indexOf(rootPath) !== -1 && !file.endsWith(path.default.sep)).map((file) => {
		return {
			type: "copy",
			source: file,
			destination: path.default.join(file.substr(idx))
		};
	});
	return Promise.resolve({ instructions });
}
function testSupportedContent(files, gameId) {
	let supported = gameId === GAME_ID && files.find((file) => path.default.extname(file).toLowerCase() === MOD_FILE_EXT) !== void 0;
	if (supported && files.find((file) => path.default.basename(file).toLowerCase() === "moduleconfig.xml" && path.default.basename(path.default.dirname(file)).toLowerCase() === "fomod")) supported = false;
	return Promise.resolve({
		supported,
		requiredFiles: []
	});
}
function toLOPrefix(context, mod) {
	const props = genProps(context);
	if (props === void 0) return "ZZZZ-" + mod.id;
	const loEntry = vortex_api.util.getSafe(props.state, [
		"persistent",
		"loadOrder",
		props.profile.id
	], []).find((loEntry) => loEntry.id === mod.id);
	return loEntry?.data?.prefix !== void 0 ? loEntry.data.prefix + "-" + mod.id : "ZZZZ-" + mod.id;
}
const localAppData = (() => {
	let cached;
	return () => {
		if (cached === void 0) cached = process.env.LOCALAPPDATA || path.default.resolve(vortex_api.util.getVortexPath("appData"), "..", "Local");
		return cached;
	};
})();
const EXECUTABLE = path.default.join("CodeVein", "Binaries", "Win64", "CodeVein-Win64-Shipping.exe");
function getGameVersion(gamePath) {
	const exeVersion = require("exe-version");
	return bluebird.default.resolve(exeVersion.getProductVersionLocalized(path.default.join(gamePath, EXECUTABLE)));
}
function main(context) {
	context.registerGame({
		id: GAME_ID,
		name: "Code Vein",
		mergeMods: (mod) => toLOPrefix(context, mod),
		queryPath: toBlue(findGame),
		requiresCleanup: true,
		supportedTools: [],
		queryModPath: () => modsRelPath(),
		logo: "gameart.jpg",
		executable: () => EXECUTABLE,
		getGameVersion,
		requiredFiles: [EXECUTABLE],
		setup: toBlue((discovery) => prepareForModding(context, discovery)),
		environment: { SteamAPPId: STEAM_ID },
		details: {
			steamAppId: +STEAM_ID,
			settingsPath: () => path.default.join(localAppData(), "CodeVein", "Saved", "Config", "WindowsNoEditor")
		}
	});
	context.registerLoadOrder({
		deserializeLoadOrder: () => deserialize(context),
		serializeLoadOrder: (loadOrder) => serialize(context, loadOrder),
		validate,
		gameId: GAME_ID,
		toggleableEntries: false,
		usageInstructions: "Drag and drop the mods on the left to reorder them. Code Vein loads mods in alphabetic order so Vortex prefixes the directory names with \"AAA, AAB, AAC, ...\" to ensure they load in the order you set here."
	});
	context.registerInstaller("codevein-mod", 25, toBlue(testSupportedContent), toBlue(installContent));
	context.registerMigration(toBlue((oldVer) => migrate100(context, oldVer)));
	return true;
}
module.exports = { default: main };

//#endregion
//# sourceMappingURL=index.js.map