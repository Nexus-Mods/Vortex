//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esmMin = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) {
		__defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	}
	if (!no_symbols) {
		__defProp(target, Symbol.toStringTag, { value: "Module" });
	}
	return target;
};
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
var __toCommonJS = (mod) => __hasOwnProp.call(mod, "module.exports") ? mod["module.exports"] : __copyProps(__defProp({}, "__esModule", { value: true }), mod);

//#endregion
let bluebird = require("bluebird");
bluebird = __toESM(bluebird);
let path = require("path");
path = __toESM(path);
let vortex_api = require("vortex-api");
let winapi_bindings = require("winapi-bindings");
winapi_bindings = __toESM(winapi_bindings);
let semver = require("semver");
semver = __toESM(semver);
let crypto = require("crypto");
crypto = __toESM(crypto);
let shortid = require("shortid");
let turbowalk = require("turbowalk");
turbowalk = __toESM(turbowalk);
let vortex_parse_ini = require("vortex-parse-ini");
vortex_parse_ini = __toESM(vortex_parse_ini);
let xml2js = require("xml2js");
let lodash = require("lodash");
lodash = __toESM(lodash);
let https = require("https");
https = __toESM(https);
let url = require("url");
url = __toESM(url);
let exe_version = require("exe-version");
exe_version = __toESM(exe_version);
let react = require("react");
react = __toESM(react);
let react_bootstrap = require("react-bootstrap");
react_bootstrap = __toESM(react_bootstrap);
let react_i18next = require("react-i18next");
let react_redux = require("react-redux");
require("ini");
let redux_act = require("redux-act");

//#region extensions/games/game-witcher3/common.ts
var common_exports = /* @__PURE__ */ __exportAll({
	ACTIVITY_ID_IMPORTING_LOADORDER: () => ACTIVITY_ID_IMPORTING_LOADORDER,
	CONFIG_MATRIX_FILES: () => CONFIG_MATRIX_FILES,
	CONFIG_MATRIX_REL_PATH: () => CONFIG_MATRIX_REL_PATH,
	DO_NOT_DEPLOY: () => DO_NOT_DEPLOY,
	DO_NOT_DISPLAY: () => DO_NOT_DISPLAY,
	GAME_ID: () => GAME_ID,
	I18N_NAMESPACE: () => I18N_NAMESPACE,
	INPUT_XML_FILENAME: () => INPUT_XML_FILENAME,
	LOAD_ORDER_FILENAME: () => LOAD_ORDER_FILENAME,
	LOCKED_PREFIX: () => LOCKED_PREFIX,
	MD5ComparisonError: () => MD5ComparisonError$1,
	MERGE_INV_MANIFEST: () => MERGE_INV_MANIFEST,
	MergeDataViolationError: () => MergeDataViolationError,
	NON_SORTABLE: () => NON_SORTABLE,
	PART_SUFFIX: () => PART_SUFFIX,
	ResourceInaccessibleError: () => ResourceInaccessibleError,
	SCRIPT_MERGER_FILES: () => SCRIPT_MERGER_FILES,
	SCRIPT_MERGER_ID: () => SCRIPT_MERGER_ID$1,
	UNI_PATCH: () => UNI_PATCH,
	VORTEX_BACKUP_TAG: () => VORTEX_BACKUP_TAG,
	W3_TEMP_DATA_DIR: () => W3_TEMP_DATA_DIR,
	calcHashImpl: () => calcHashImpl,
	getHash: () => getHash$1,
	getLoadOrderFilePath: () => getLoadOrderFilePath,
	getPriorityTypeBranch: () => getPriorityTypeBranch,
	getSuppressModLimitBranch: () => getSuppressModLimitBranch
});
function calcHashImpl(filePath) {
	return new Promise((resolve, reject) => {
		const hash = crypto.default.createHash("md5");
		const stream = vortex_api.fs.createReadStream(filePath);
		stream.on("readable", () => {
			const data = stream.read();
			if (data) hash.update(data);
		});
		stream.on("end", () => resolve(hash.digest("hex")));
		stream.on("error", reject);
	});
}
function getHash$1(filePath, tries = 3) {
	return calcHashImpl(filePath).catch((err) => {
		if (["EMFILE", "EBADF"].includes(err["code"]) && tries > 0) return getHash$1(filePath, tries - 1);
		else return Promise.reject(err);
	});
}
function getLoadOrderFilePath() {
	return path.default.join(vortex_api.util.getVortexPath("documents"), "The Witcher 3", LOAD_ORDER_FILENAME);
}
function getPriorityTypeBranch() {
	return [
		"settings",
		"witcher3",
		"prioritytype"
	];
}
function getSuppressModLimitBranch() {
	return [
		"settings",
		"witcher3",
		"suppressModLimitPatch"
	];
}
var MD5ComparisonError$1, ResourceInaccessibleError, MergeDataViolationError, GAME_ID, INPUT_XML_FILENAME, VORTEX_BACKUP_TAG, PART_SUFFIX, SCRIPT_MERGER_ID$1, MERGE_INV_MANIFEST, LOAD_ORDER_FILENAME, I18N_NAMESPACE, CONFIG_MATRIX_REL_PATH, CONFIG_MATRIX_FILES, W3_TEMP_DATA_DIR, UNI_PATCH, LOCKED_PREFIX, DO_NOT_DISPLAY, DO_NOT_DEPLOY, SCRIPT_MERGER_FILES, NON_SORTABLE, ACTIVITY_ID_IMPORTING_LOADORDER;
var init_common = __esmMin((() => {
	MD5ComparisonError$1 = class extends Error {
		constructor(message, file) {
			super(message);
			this.mPath = file;
		}
		get affectedFile() {
			return this.mPath;
		}
		get errorMessage() {
			return this.message + ": " + this.mPath;
		}
	};
	ResourceInaccessibleError = class extends Error {
		constructor(filePath, allowReport = false) {
			super(`"${filePath}" is being manipulated by another process`);
			this.mFilePath = filePath;
			this.mIsReportingAllowed = allowReport;
		}
		get isOneDrive() {
			return this.mFilePath.split(path.default.sep).filter((seg) => !!seg).map((seg) => seg.toLowerCase()).includes("onedrive");
		}
		get allowReport() {
			return this.mIsReportingAllowed;
		}
		get errorMessage() {
			return this.isOneDrive ? this.message + ": probably by the OneDrive service." : this.message + ": close all applications that may be using this file.";
		}
	};
	MergeDataViolationError = class extends Error {
		constructor(notIncluded, optional, collectionName) {
			super(`Merged script data for ${collectionName} is referencing missing/undeployed/optional mods`);
			this.name = "MergeDataViolationError";
			this.mOptional = optional;
			this.mNotIncluded = notIncluded;
			this.mCollectionName = collectionName;
		}
		get Optional() {
			return this.mOptional;
		}
		get NotIncluded() {
			return this.mNotIncluded;
		}
		get CollectionName() {
			return this.mCollectionName;
		}
	};
	GAME_ID = "witcher3";
	INPUT_XML_FILENAME = "input.xml";
	VORTEX_BACKUP_TAG = ".vortex_backup";
	PART_SUFFIX = ".part.txt";
	SCRIPT_MERGER_ID$1 = "W3ScriptMerger";
	MERGE_INV_MANIFEST = "MergeInventory.xml";
	LOAD_ORDER_FILENAME = "mods.settings";
	I18N_NAMESPACE = "game-witcher3";
	CONFIG_MATRIX_REL_PATH = path.default.join("bin", "config", "r4game", "user_config_matrix", "pc");
	CONFIG_MATRIX_FILES = [
		"audio",
		"display",
		"gameplay",
		"gamma",
		"graphics",
		"graphicsdx11",
		"hdr",
		"hidden",
		"hud",
		"input",
		"localization"
	];
	W3_TEMP_DATA_DIR = path.default.join(vortex_api.util.getVortexPath("temp"), "W3TempData");
	UNI_PATCH = "mod0000____CompilationTrigger";
	LOCKED_PREFIX = "mod0000_";
	DO_NOT_DISPLAY = ["communitypatch-base"];
	DO_NOT_DEPLOY = ["README.TXT", `**/*${PART_SUFFIX.toUpperCase()}`];
	SCRIPT_MERGER_FILES = ["WitcherScriptMerger.exe"];
	NON_SORTABLE = ["witcher3menumoddocuments", "collection"];
	ACTIVITY_ID_IMPORTING_LOADORDER = "activity-witcher3-importing-loadorder";
}));

//#endregion
//#region extensions/games/game-witcher3/migrations.ts
init_common();
async function migrate148(context, oldVersion) {
	if (semver.default.gte(oldVersion, "1.4.8")) return Promise.resolve();
	const state = context.api.getState();
	const lastActiveProfile = vortex_api.selectors.lastActiveProfileForGame(state, GAME_ID);
	const profile = vortex_api.selectors.profileById(state, lastActiveProfile);
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID
	], {});
	const modState = vortex_api.util.getSafe(profile, ["modState"], {});
	const isEnabled = (mod) => modState[mod.id]?.enabled === true;
	if (Object.values(mods).find((mod) => mod.type === "w3modlimitpatcher" && isEnabled(mod)) === void 0) return Promise.resolve();
	const t = context.api.translate;
	context.api.sendNotification({
		type: "warning",
		allowSuppress: false,
		message: t("Faulty Witcher 3 Mod Limit Patch detected"),
		actions: [{
			title: "More",
			action: (dismiss) => {
				dismiss();
				context.api.showDialog("info", "Witcher 3 Mod Limit Patch", { text: t("Due to a bug, the mod limit patch was not applied correctly. Please Uninstall/Remove your existing mod limit match mod entry in your mods page and re-apply the patch using the \"Apply Mod Limit Patch\" button.") }, [{ label: "Close" }]);
			}
		}]
	});
	return Promise.resolve();
}
function getPersistentLoadOrder(api, loadOrder) {
	const state = api.getState();
	const profile = vortex_api.selectors.activeProfile(state);
	if (profile?.gameId !== GAME_ID) return [];
	loadOrder = loadOrder ?? vortex_api.util.getSafe(state, [
		"persistent",
		"loadOrder",
		profile.id
	], void 0);
	if (loadOrder === void 0) return [];
	if (Array.isArray(loadOrder)) return loadOrder;
	if (typeof loadOrder === "object") return Object.entries(loadOrder).map(([key, item]) => convertDisplayItem(key, item));
	return [];
}
function convertDisplayItem(key, item) {
	return {
		id: key,
		modId: key,
		name: key,
		locked: item.locked,
		enabled: true,
		data: { prefix: item.prefix }
	};
}

//#endregion
//#region extensions/games/game-witcher3/collections/util.ts
/** eslint-disable */
init_common();
var CollectionGenerateError = class extends Error {
	constructor(why) {
		super(`Failed to generate game specific data for collection: ${why}`);
		this.name = "CollectionGenerateError";
	}
};
var CollectionParseError = class extends Error {
	constructor(collectionName, why) {
		super(`Failed to parse game specific data for collection ${collectionName}: ${why}`);
		this.name = "CollectionGenerateError";
	}
};
function isValidMod(mod) {
	return mod !== void 0 && mod.type !== "collection";
}
function isModInCollection(collectionMod, mod) {
	if (collectionMod.rules === void 0) return false;
	return collectionMod.rules.find((rule) => vortex_api.util.testModReference(mod, rule.reference)) !== void 0;
}
function genCollectionLoadOrder(loadOrder, mods, collection) {
	return loadOrder.filter((entry) => {
		return entry.modId.includes(LOCKED_PREFIX) || (collection !== void 0 ? isValidMod(mods[entry.modId]) && isModInCollection(collection, mods[entry.modId]) : isValidMod(mods[entry.modId]));
	}).sort((lhs, rhs) => lhs.data.prefix - rhs.data.prefix).reduce((accum, iter, idx) => {
		accum.push(iter);
		return accum;
	}, []);
}
async function walkDirPath(dirPath) {
	let fileEntries = [];
	await (0, turbowalk.default)(dirPath, (entries) => {
		fileEntries = fileEntries.concat(entries);
	}).catch({ systemCode: 3 }, () => Promise.resolve()).catch((err) => ["ENOTFOUND", "ENOENT"].includes(err.code) ? Promise.resolve() : Promise.reject(err));
	return fileEntries;
}
async function prepareFileData(dirPath) {
	const sevenZip = new vortex_api.util.SevenZip();
	try {
		await vortex_api.fs.ensureDirWritableAsync(W3_TEMP_DATA_DIR);
		const archivePath = path.default.join(W3_TEMP_DATA_DIR, (0, shortid.generate)() + ".zip");
		const entries = await vortex_api.fs.readdirAsync(dirPath);
		await sevenZip.add(archivePath, entries.map((entry) => path.default.join(dirPath, entry)), { raw: ["-r"] });
		const data = await vortex_api.fs.readFileAsync(archivePath);
		await vortex_api.fs.removeAsync(archivePath);
		return data;
	} catch (err) {
		return Promise.reject(err);
	}
}
async function cleanUpEntries(fileEntries) {
	try {
		fileEntries.sort((lhs, rhs) => rhs.filePath.length - lhs.filePath.length);
		for (const entry of fileEntries) await vortex_api.fs.removeAsync(entry.filePath);
	} catch (err) {
		(0, vortex_api.log)("error", "file entry cleanup failed", err);
	}
}
async function restoreFileData(fileData, destination) {
	const sevenZip = new vortex_api.util.SevenZip();
	let archivePath;
	let fileEntries = [];
	try {
		await vortex_api.fs.ensureDirWritableAsync(W3_TEMP_DATA_DIR);
		archivePath = path.default.join(W3_TEMP_DATA_DIR, (0, shortid.generate)() + ".zip");
		await vortex_api.fs.writeFileAsync(archivePath, fileData);
		const targetDirPath = path.default.join(W3_TEMP_DATA_DIR, path.default.basename(archivePath, ".zip"));
		await sevenZip.extractFull(archivePath, targetDirPath);
		fileEntries = await walkDirPath(targetDirPath);
		for (const entry of fileEntries) {
			const relPath = path.default.relative(targetDirPath, entry.filePath);
			const dest = path.default.join(destination, relPath);
			await vortex_api.fs.ensureDirWritableAsync(path.default.dirname(dest));
			await vortex_api.fs.copyAsync(entry.filePath, dest);
		}
		cleanUpEntries(fileEntries);
		return Promise.resolve();
	} catch (err) {
		cleanUpEntries(fileEntries);
		return Promise.reject(err);
	}
}
function hex2Buffer(hexData) {
	const byteArray = new Uint8Array(hexData.length / 2);
	for (let x = 0; x < byteArray.length; x++) byteArray[x] = parseInt(hexData.substr(x * 2, 2), 16);
	return Buffer.from(byteArray);
}

//#endregion
//#region extensions/games/game-witcher3/collections/loadOrder.ts
init_common();
async function exportLoadOrder(api, modIds, mods) {
	const state = api.getState();
	if (vortex_api.selectors.lastActiveProfileForGame(state, GAME_ID) === void 0) return Promise.reject(new CollectionGenerateError("Invalid profile id"));
	const loadOrder = getPersistentLoadOrder(api);
	if (loadOrder === void 0) return Promise.resolve(void 0);
	const filteredLO = genCollectionLoadOrder(loadOrder, modIds.reduce((accum, iter) => {
		if (mods[iter] !== void 0) accum[iter] = mods[iter];
		return accum;
	}, {}));
	return Promise.resolve(filteredLO);
}
async function importLoadOrder$1(api, collection) {
	const state = api.getState();
	const profileId = vortex_api.selectors.lastActiveProfileForGame(state, GAME_ID);
	if (profileId === void 0) return Promise.reject(new CollectionParseError(collection?.["info"]?.["name"] || "", "Invalid profile id"));
	const converted = getPersistentLoadOrder(api, collection.loadOrder);
	api.store.dispatch(vortex_api.actions.setLoadOrder(profileId, converted));
	return Promise.resolve(void 0);
}

//#endregion
//#region extensions/games/game-witcher3/iniParser.ts
init_common();
var IniStructure = class IniStructure {
	static {
		this.instance = null;
	}
	static getInstance(api, priorityManager) {
		if (!IniStructure.instance) {
			if (api === void 0 || priorityManager === void 0) throw new Error("IniStructure is not context aware");
			IniStructure.instance = new IniStructure(api, priorityManager);
		}
		return IniStructure.instance;
	}
	constructor(api, priorityManager) {
		this.mIniStruct = {};
		this.mIniStruct = {};
		this.mApi = api;
		this.mPriorityManager = priorityManager();
	}
	async getIniStructure() {
		return this.mIniStruct;
	}
	async setINIStruct(loadOrder) {
		const modMap = await getAllMods(this.mApi);
		this.mIniStruct = {};
		const mods = [].concat(modMap.merged, modMap.managed, modMap.manual);
		const manualLocked = modMap.manual.filter(isLockedEntry);
		const managedLocked = modMap.managed.filter((entry) => isLockedEntry(entry.name)).map((entry) => entry.name);
		const totalLocked = [].concat(modMap.merged, manualLocked, managedLocked);
		this.mIniStruct = mods.reduce((accum, mod, idx) => {
			let name;
			let key;
			if (typeof mod === "object" && !!mod) {
				name = mod.name;
				key = mod.id;
			} else {
				name = mod;
				key = mod;
			}
			if (name.toLowerCase().startsWith("dlc")) return accum;
			const idxOfEntry = (loadOrder || []).findIndex((iter) => iter.id === name);
			const LOEntry = loadOrder.at(idxOfEntry);
			if (idx === 0) this.mPriorityManager?.resetMaxPriority(totalLocked.length);
			accum[name] = {
				Enabled: LOEntry !== void 0 ? LOEntry.enabled ? 1 : 0 : 1,
				Priority: totalLocked.includes(name) ? totalLocked.indexOf(name) + 1 : idxOfEntry === -1 ? loadOrder.length + 1 : idxOfEntry + totalLocked.length,
				VK: key
			};
			return accum;
		}, {});
		return this.writeToModSettings();
	}
	async revertLOFile() {
		const state = this.mApi.getState();
		const profile = vortex_api.selectors.activeProfile(state);
		if (!!profile && profile.gameId === GAME_ID) {
			const manuallyAdded = await getManuallyAddedMods(this.mApi);
			if (manuallyAdded.length > 0) {
				const newStruct = {};
				manuallyAdded.forEach((mod, idx) => {
					newStruct[mod] = {
						Enabled: 1,
						Priority: idx + 1
					};
				});
				this.mIniStruct = newStruct;
				await this.writeToModSettings().then(() => {
					forceRefresh(this.mApi);
					return Promise.resolve();
				}).catch((err) => this.modSettingsErrorHandler(err, "Failed to cleanup load order file"));
			} else {
				const filePath = getLoadOrderFilePath();
				await vortex_api.fs.removeAsync(filePath).catch((err) => err.code !== "ENOENT" ? this.mApi.showErrorNotification("Failed to cleanup load order file", err) : null);
				forceRefresh(this.mApi);
				return Promise.resolve();
			}
		}
	}
	async ensureModSettings() {
		const filePath = getLoadOrderFilePath();
		const parser = new vortex_parse_ini.default(new vortex_parse_ini.WinapiFormat());
		return vortex_api.fs.statAsync(filePath).then(() => parser.read(filePath)).catch((err) => err.code === "ENOENT" ? this.createModSettings().then(() => parser.read(filePath)) : Promise.reject(err));
	}
	async createModSettings() {
		const filePath = getLoadOrderFilePath();
		return vortex_api.fs.ensureDirWritableAsync(path.default.dirname(filePath)).then(() => vortex_api.fs.writeFileAsync(filePath, "", { encoding: "utf8" }));
	}
	modSettingsErrorHandler(err, errMessage) {
		let allowReport = true;
		if (err instanceof vortex_api.util.UserCanceled) allowReport = false;
		const busyResource = err instanceof ResourceInaccessibleError;
		if (allowReport && busyResource) {
			allowReport = err.allowReport;
			err.message = err.errorMessage;
		}
		this.mApi.showErrorNotification(errMessage, err, { allowReport });
	}
	async readStructure() {
		const state = this.mApi.getState();
		if (vortex_api.selectors.activeProfile(state)?.id === void 0) return Promise.resolve(null);
		const filePath = getLoadOrderFilePath();
		const ini = await new vortex_parse_ini.default(new vortex_parse_ini.WinapiFormat()).read(filePath);
		const data = Object.entries(ini.data).reduce((accum, [key, value]) => {
			if (key.toLowerCase().startsWith("dlc")) return accum;
			accum[key] = value;
			return accum;
		}, {});
		return Promise.resolve(data);
	}
	async writeToModSettings() {
		const filePath = getLoadOrderFilePath();
		const parser = new vortex_parse_ini.default(new vortex_parse_ini.WinapiFormat());
		try {
			await vortex_api.fs.removeAsync(filePath);
			await vortex_api.fs.writeFileAsync(filePath, "", { encoding: "utf8" });
			const ini = await this.ensureModSettings();
			const struct = Object.keys(this.mIniStruct).sort((a, b) => this.mIniStruct[a].Priority - this.mIniStruct[b].Priority);
			for (const key of struct) {
				if (this.mIniStruct?.[key]?.Enabled === void 0) continue;
				ini.data[key] = {
					Enabled: this.mIniStruct[key].Enabled,
					Priority: this.mIniStruct[key].Priority,
					VK: this.mIniStruct[key].VK
				};
			}
			await parser.write(filePath, ini);
			return Promise.resolve();
		} catch (err) {
			return err.path !== void 0 && ["EPERM", "EBUSY"].includes(err.code) ? Promise.reject(new ResourceInaccessibleError(err.path)) : Promise.reject(err);
		}
	}
};

//#endregion
//#region extensions/games/game-witcher3/mergeInventoryParsing.ts
init_common();
function getMergeInventory(api) {
	const state = api.getState();
	const discovery = vortex_api.util.getSafe(state, [
		"settings",
		"gameMode",
		"discovered",
		GAME_ID
	], void 0);
	const scriptMerger = vortex_api.util.getSafe(discovery, ["tools", SCRIPT_MERGER_ID$1], void 0);
	if (scriptMerger === void 0 || scriptMerger.path === void 0) return bluebird.default.resolve([]);
	return vortex_api.fs.readFileAsync(path.default.join(path.default.dirname(scriptMerger.path), MERGE_INV_MANIFEST)).then(async (xmlData) => {
		try {
			const mergeData = await (0, xml2js.parseStringPromise)(xmlData);
			return Promise.resolve(mergeData);
		} catch (err) {
			return Promise.reject(err);
		}
	}).catch((err) => err.code === "ENOENT" ? Promise.resolve(void 0) : Promise.reject(new vortex_api.util.DataInvalid(`Failed to parse ${MERGE_INV_MANIFEST}: ${err}`)));
}
function getMergedModNames(api) {
	return getMergeInventory(api).then(async (mergeInventory) => {
		if (mergeInventory === void 0) return Promise.resolve([]);
		const state = api.getState();
		const discovery = vortex_api.util.getSafe(state, [
			"settings",
			"gameMode",
			"discovered",
			GAME_ID
		], void 0);
		const modsPath = path.default.join(discovery.path, "Mods");
		const mergeEntry = mergeInventory?.MergeInventory?.Merge;
		if (mergeEntry === void 0) {
			let inv;
			try {
				inv = JSON.stringify(mergeInventory);
			} catch (err) {
				return Promise.reject(err);
			}
			(0, vortex_api.log)("debug", "failed to retrieve merged mod names", inv);
			return Promise.resolve([]);
		}
		const elements = await mergeEntry.reduce(async (accumP, iter) => {
			const accum = await accumP;
			const mergeModName = iter?.MergedModName?.[0];
			if (mergeModName === void 0) return accum;
			if (!accum.includes(mergeModName)) try {
				await vortex_api.fs.statAsync(path.default.join(modsPath, mergeModName));
				accum.push(mergeModName);
			} catch (err) {
				(0, vortex_api.log)("debug", "merged mod is missing", mergeModName);
			}
			return accum;
		}, []);
		return Promise.resolve(elements);
	}).catch((err) => {
		api.showErrorNotification("Invalid MergeInventory.xml file", err, { allowReport: false });
		return Promise.resolve([]);
	});
}
function getNamesOfMergedMods(api) {
	return getMergeInventory(api).then(async (mergeInventory) => {
		if (mergeInventory === void 0) return Promise.resolve([]);
		const state = api.getState();
		const discovery = vortex_api.util.getSafe(state, [
			"settings",
			"gameMode",
			"discovered",
			GAME_ID
		], void 0);
		const modsPath = path.default.join(discovery.path, "Mods");
		const modNames = await mergeInventory.MergeInventory.Merge.reduce(async (accumP, iter) => {
			const accum = await accumP;
			const mergedMods = iter?.IncludedMod;
			for (const modName of mergedMods) {
				if (modName === void 0) return accum;
				if (!accum.includes(modName?._)) try {
					await vortex_api.fs.statAsync(path.default.join(modsPath, modName?._));
					accum.push(modName?._);
				} catch (err) {
					(0, vortex_api.log)("debug", "merged mod is missing", modName?._);
				}
			}
			return accum;
		}, []);
		return Promise.resolve(modNames);
	});
}

//#endregion
//#region extensions/games/game-witcher3/util.ts
init_common();
async function getDeployment(api, includedMods) {
	const state = api.getState();
	const discovery = vortex_api.util.getSafe(state, [
		"settings",
		"gameMode",
		"discovered",
		GAME_ID
	], void 0);
	const game = vortex_api.util.getGame(GAME_ID);
	if (game === void 0 || discovery?.path === void 0) {
		(0, vortex_api.log)("error", "game is not discovered", GAME_ID);
		return;
	}
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID
	], {});
	const installationDirectories = Object.values(mods).filter((mod) => includedMods !== void 0 ? includedMods.includes(mod.id) : true).map((mod) => mod.installationPath);
	const filterFunc = (file) => installationDirectories.includes(file.source);
	const modPaths = game.getModPaths(discovery.path);
	return await Object.keys(modPaths).filter((key) => !!modPaths[key]).reduce(async (accumP, modType) => {
		const accum = await accumP;
		try {
			accum[modType] = (await vortex_api.util.getManifest(api, modType, GAME_ID)).files.filter(filterFunc);
		} catch (err) {
			(0, vortex_api.log)("error", "failed to get manifest", err);
		}
		return accum;
	}, {});
}
const getDocumentsPath = (game) => {
	return path.default.join(vortex_api.util.getVortexPath("documents"), "The Witcher 3");
};
const getDLCPath = (api) => {
	return (game) => {
		const discovery = api.store.getState().settings.gameMode.discovered[game.id];
		return path.default.join(discovery.path, "DLC");
	};
};
const getTLPath = ((api) => {
	return (game) => {
		return api.store.getState().settings.gameMode.discovered[game.id].path;
	};
});
const isTW3 = (api) => {
	return (gameId) => {
		if (gameId !== void 0) return gameId === GAME_ID;
		const state = api.getState();
		return vortex_api.selectors.activeGameId(state) === GAME_ID;
	};
};
function notifyMissingScriptMerger(api) {
	api.sendNotification({
		id: "missing-script-merger",
		type: "info",
		message: api.translate("Witcher 3 script merger is missing/misconfigured", { ns: I18N_NAMESPACE }),
		allowSuppress: true,
		actions: [{
			title: "More",
			action: () => {
				api.showDialog("info", "Witcher 3 Script Merger", { bbcode: api.translate("Vortex is unable to resolve the Script Merger's location. The tool needs to be downloaded and configured manually. [url=https://wiki.nexusmods.com/index.php/Tool_Setup:_Witcher_3_Script_Merger]Find out more about how to configure it as a tool for use in Vortex.[/url][br][/br][br][/br]Note: While script merging works well with the vast majority of mods, there is no guarantee for a satisfying outcome in every single case.", { ns: I18N_NAMESPACE }) }, [{
					label: "Cancel",
					action: () => {
						api.dismissNotification("missing-script-merger");
					}
				}, {
					label: "Download Script Merger",
					action: () => vortex_api.util.opn("https://www.nexusmods.com/witcher3/mods/484").catch((err) => null).then(() => api.dismissNotification("missing-script-merger"))
				}]);
			}
		}]
	});
}
async function findModFolders(installationPath, mod) {
	if (!installationPath || !mod?.installationPath) {
		const errMessage = !installationPath ? "Game is not discovered" : "Failed to resolve mod installation path";
		return Promise.reject(new Error(errMessage));
	}
	const validNames = /* @__PURE__ */ new Set();
	await (0, turbowalk.default)(path.default.join(installationPath, mod.installationPath), (entries) => {
		entries.forEach((entry) => {
			const segments = entry.filePath.split(path.default.sep);
			const contentIdx = segments.findIndex((seg) => seg.toLowerCase() === "content");
			if (![-1, 0].includes(contentIdx)) validNames.add(segments[contentIdx - 1]);
		});
	}, {
		recurse: true,
		skipHidden: true,
		skipLinks: true
	});
	const validEntries = Array.from(validNames);
	return validEntries.length > 0 ? Promise.resolve(validEntries) : Promise.reject(/* @__PURE__ */ new Error("Failed to find mod folder"));
}
async function getManagedModNames(api, mods) {
	const installationPath = vortex_api.selectors.installPathForGame(api.getState(), GAME_ID);
	return mods.reduce(async (accumP, mod) => {
		const accum = await accumP;
		let folderNames = [];
		try {
			if (!folderNames || ["collection", "w3modlimitpatcher"].includes(mod.type)) return Promise.resolve(accum);
			folderNames = await findModFolders(installationPath, mod);
			for (const component of folderNames) accum.push({
				id: mod.id,
				name: component
			});
		} catch (err) {
			(0, vortex_api.log)("warn", "unable to resolve mod name", mod.id);
		}
		return Promise.resolve(accum);
	}, Promise.resolve([]));
}
async function getAllMods(api) {
	const invalidModTypes = ["witcher3menumoddocuments", "collection"];
	const state = api.getState();
	const profile = vortex_api.selectors.activeProfile(state);
	if (profile?.id === void 0) return Promise.resolve({
		merged: [],
		manual: [],
		managed: []
	});
	const modState = vortex_api.util.getSafe(state, [
		"persistent",
		"profiles",
		profile.id,
		"modState"
	], {});
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID
	], {});
	const enabledMods = Object.keys(modState).filter((key) => !!mods[key] && modState[key].enabled && !invalidModTypes.includes(mods[key].type));
	const mergedModNames = await getMergedModNames(api);
	const manuallyAddedMods = await getManuallyAddedMods(api);
	const managedMods = await getManagedModNames(api, enabledMods.map((key) => mods[key]));
	return Promise.resolve({
		merged: mergedModNames,
		manual: manuallyAddedMods.filter((mod) => !mergedModNames.includes(mod)),
		managed: managedMods
	});
}
async function getManuallyAddedMods(api) {
	const state = api.getState();
	const discovery = vortex_api.util.getSafe(state, [
		"settings",
		"gameMode",
		"discovered",
		GAME_ID
	], void 0);
	if (discovery?.path === void 0) return Promise.reject(new vortex_api.util.ProcessCanceled("Game is not discovered!"));
	let ini;
	try {
		ini = await IniStructure.getInstance().ensureModSettings();
	} catch (err) {
		api.showErrorNotification("Failed to load INI structure", err, { allowReport: false });
		return Promise.resolve([]);
	}
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID
	], {});
	const modKeys = Object.keys(mods);
	const iniEntries = Object.keys(ini.data);
	const manualCandidates = [].concat(iniEntries).filter((entry) => {
		return !(vortex_api.util.getSafe(ini.data[entry], ["VK"], void 0) !== void 0) || ini.data[entry].VK === entry && !modKeys.includes(entry);
	});
	const uniqueCandidates = new Set(new Set(manualCandidates));
	const modsPath = path.default.join(discovery.path, "Mods");
	const validCandidates = await Array.from(uniqueCandidates).reduce(async (accumP, mod) => {
		const accum = await accumP;
		const modFolder = path.default.join(modsPath, mod);
		if (!vortex_api.fs.statAsync(path.default.join(modFolder)).then(() => true).catch(() => false)) return Promise.resolve(accum);
		try {
			const entries = await walkPath(modFolder, {
				skipHidden: true,
				skipLinks: true
			});
			if (entries.length > 0) {
				if (entries.filter((entry) => !entry.isDirectory && path.default.extname(path.default.basename(entry.filePath)) !== "" && (entry?.linkCount === void 0 || entry.linkCount <= 1)).length > 0) accum.push(mod);
			}
		} catch (err) {
			if (!["ENOENT", "ENOTFOUND"].some(err.code)) (0, vortex_api.log)("error", "unable to walk path", err);
			return Promise.resolve(accum);
		}
		return Promise.resolve(accum);
	}, Promise.resolve([]));
	return Promise.resolve(validCandidates);
}
function isLockedEntry(modName) {
	if (!modName || typeof modName !== "string") {
		(0, vortex_api.log)("debug", "encountered invalid mod instance/name");
		return false;
	}
	return modName.startsWith(LOCKED_PREFIX);
}
function determineExecutable(discoveredPath) {
	if (discoveredPath !== void 0) try {
		vortex_api.fs.statSync(path.default.join(discoveredPath, "bin", "x64_DX12", "witcher3.exe"));
		return "bin/x64_DX12/witcher3.exe";
	} catch (err) {}
	return "bin/x64/witcher3.exe";
}
function forceRefresh(api) {
	const state = api.getState();
	const action = {
		type: "SET_FB_FORCE_UPDATE",
		payload: { profileId: vortex_api.selectors.lastActiveProfileForGame(state, GAME_ID) }
	};
	api.store.dispatch(action);
}
async function walkPath(dirPath, walkOptions) {
	walkOptions = walkOptions || {
		skipLinks: true,
		skipHidden: true,
		skipInaccessible: true
	};
	walkOptions = {
		...walkOptions,
		skipHidden: true,
		skipInaccessible: true,
		skipLinks: true
	};
	const walkResults = [];
	return new Promise(async (resolve, reject) => {
		await (0, turbowalk.default)(dirPath, (entries) => {
			walkResults.push(...entries);
			return Promise.resolve();
		}, walkOptions).catch((err) => err.code === "ENOENT" ? Promise.resolve() : Promise.reject(err));
		return resolve(walkResults);
	});
}
function validateProfile(profileId, state) {
	const activeProfile = vortex_api.selectors.activeProfile(state);
	const deployProfile = vortex_api.selectors.profileById(state, profileId);
	if (!!activeProfile && !!deployProfile && deployProfile.id !== activeProfile.id) return;
	if (activeProfile?.gameId !== GAME_ID) return;
	return activeProfile;
}
function isXML(filePath) {
	return [".xml"].includes(path.default.extname(filePath).toLowerCase());
}
function suppressEventHandlers(api) {
	return api.getState().session.notifications.notifications.some((n) => n.id === ACTIVITY_ID_IMPORTING_LOADORDER);
}
async function fileExists(filePath) {
	return vortex_api.fs.statAsync(filePath).then(() => true).catch(() => false);
}

//#endregion
//#region extensions/games/game-witcher3/menumod.ts
init_common();
const IniParser = require("vortex-parse-ini");
const INVALID_CHARS = /[:/\\*?"<>|]/g;
const INPUT_SETTINGS_FILENAME = "input.settings";
const DX_11_USER_SETTINGS_FILENAME = "user.settings";
const DX_12_USER_SETTINGS_FILENAME = "dx12user.settings";
const BACKUP_TAG = ".vortex_backup";
const CACHE_FILENAME = "vortex_menumod.cache";
async function getExistingCache(state, activeProfile) {
	const stagingFolder = vortex_api.selectors.installPathForGame(state, GAME_ID);
	const modName = menuMod(activeProfile.name);
	const mod = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID,
		modName
	], void 0);
	if (mod === void 0) return [];
	try {
		const cacheData = await vortex_api.fs.readFileAsync(path.default.join(stagingFolder, mod.installationPath, CACHE_FILENAME), { encoding: "utf8" });
		return JSON.parse(cacheData);
	} catch (err) {
		(0, vortex_api.log)("warn", "W3: failed to read/parse cache file", err);
		return [];
	}
}
function toFileMapKey(filePath) {
	return path.default.basename(filePath).toLowerCase().replace(PART_SUFFIX, "");
}
function readModData(filePath) {
	return vortex_api.fs.readFileAsync(filePath, { encoding: "utf8" }).catch((err) => Promise.resolve(void 0));
}
function populateCache(api, activeProfile, modIds, initialCacheValue) {
	const state = api.store.getState();
	const loadOrder = getPersistentLoadOrder(api);
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID
	], {});
	const modState = vortex_api.util.getSafe(activeProfile, ["modState"], {});
	let nextAvailableId = Object.keys(loadOrder).length;
	const getNextId = () => {
		return nextAvailableId++;
	};
	const toIdx = (loItem) => loadOrder.indexOf(loItem) || getNextId();
	const invalidModTypes = ["witcher3menumoddocuments"];
	const enabledMods = (modIds === void 0 ? Object.keys(mods) : modIds).filter((key) => mods[key]?.installationPath !== void 0 && !!modState[key]?.enabled && !invalidModTypes.includes(mods[key].type)).sort((lhs, rhs) => toIdx(lhs) - toIdx(rhs)).map((key) => mods[key]);
	const getRelevantModEntries = async (source) => {
		let allEntries = [];
		await require("turbowalk").default(source, (entries) => {
			const relevantEntries = entries.filter((entry) => entry.filePath.endsWith(PART_SUFFIX) && entry.filePath.indexOf(INPUT_XML_FILENAME) === -1).map((entry) => entry.filePath);
			allEntries = [].concat(allEntries, relevantEntries);
		}).catch((err) => {
			if (["ENOENT", "ENOTFOUND"].indexOf(err.code) === -1) (0, vortex_api.log)("error", "Failed to lookup menu mod files", {
				path: source,
				error: err.message
			});
		});
		return allEntries;
	};
	const stagingFolder = vortex_api.selectors.installPathForGame(state, GAME_ID);
	return bluebird.default.reduce(enabledMods, (accum, mod) => {
		if (mod.installationPath === void 0) return accum;
		return getRelevantModEntries(path.default.join(stagingFolder, mod.installationPath)).then((entries) => {
			return bluebird.default.each(entries, (filepath) => {
				return readModData(filepath).then((data) => {
					if (data !== void 0) accum.push({
						id: mod.id,
						filepath,
						data
					});
				});
			}).then(() => Promise.resolve(accum));
		});
	}, initialCacheValue !== void 0 ? initialCacheValue : []).then((newCache) => {
		const modName = menuMod(activeProfile.name);
		let mod = vortex_api.util.getSafe(state, [
			"persistent",
			"mods",
			GAME_ID,
			modName
		], void 0);
		if (mod?.installationPath === void 0) {
			(0, vortex_api.log)("warn", "failed to ascertain installation path", modName);
			return Promise.resolve();
		}
		return vortex_api.fs.writeFileAsync(path.default.join(stagingFolder, mod.installationPath, CACHE_FILENAME), JSON.stringify(newCache));
	});
}
function convertFilePath(filePath, installPath) {
	const segments = filePath.split(path.default.sep);
	const idx = segments.reduce((prev, seg, idx) => {
		if (seg.toLowerCase() === GAME_ID) return idx;
		else return prev;
	}, -1);
	if (idx === -1) {
		(0, vortex_api.log)("error", "unexpected menu mod filepath", filePath);
		return filePath;
	}
	const relPath = segments.slice(idx + 2).join(path.default.sep);
	return path.default.join(installPath, relPath);
}
async function onWillDeploy$1(api, deployment, activeProfile) {
	const state = api.store.getState();
	if (activeProfile?.name === void 0) return;
	const installPath = vortex_api.selectors.installPathForGame(state, activeProfile.gameId);
	const modName = menuMod(activeProfile.name);
	const destinationFolder = path.default.join(installPath, modName);
	const game = vortex_api.util.getGame(activeProfile.gameId);
	const discovery = vortex_api.selectors.discoveryByGame(state, activeProfile.gameId);
	const docModPath = game.getModPaths(discovery.path)["witcher3menumoddocuments"];
	if ((await getExistingCache(state, activeProfile)).length === 0) return;
	const docFiles = (deployment["witcher3menumodroot"] ?? []).filter((file) => file.relPath.endsWith(PART_SUFFIX) && file.relPath.indexOf(INPUT_XML_FILENAME) === -1);
	if (docFiles.length <= 0) return;
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID
	], {});
	const modState = vortex_api.util.getSafe(activeProfile, ["modState"], {});
	const invalidModTypes = ["witcher3menumoddocuments"];
	const enabledMods = Object.keys(mods).filter((key) => !!modState[key]?.enabled && !invalidModTypes.includes(mods[key].type));
	const parser = new IniParser.default(new IniParser.WinapiFormat());
	const fileMap = await cacheToFileMap(state, activeProfile);
	if (fileMap === void 0) return;
	const keys = Object.keys(fileMap);
	const matcher = (entry) => keys.includes(toFileMapKey(entry.relPath));
	const newCache = await bluebird.default.reduce(keys, async (accum, key) => {
		if (docFiles.find(matcher) !== void 0) {
			const mergedData = await parser.read(path.default.join(docModPath, key));
			await bluebird.default.each(fileMap[key], async (iter) => {
				if (enabledMods.includes(iter.id)) {
					const tempPath = path.default.join(destinationFolder, key) + (0, shortid.generate)();
					const modData = await toIniFileObject(iter.data, tempPath);
					const modKeys = Object.keys(modData.data);
					let changed = false;
					return bluebird.default.each(modKeys, (modKey) => {
						if (mergedData.data[modKey] !== void 0 && modData.data[modKey] !== void 0 && mergedData.data[modKey] !== modData.data[modKey]) {
							modData.data[modKey] = mergedData.data[modKey];
							changed = true;
						}
					}).then(async () => {
						let newModData;
						if (changed) {
							await parser.write(iter.filepath, modData);
							newModData = await readModData(iter.filepath);
						} else newModData = iter.data;
						if (newModData !== void 0) accum.push({
							id: iter.id,
							filepath: iter.filepath,
							data: newModData
						});
					});
				}
			});
		}
		return Promise.resolve(accum);
	}, []);
	return vortex_api.fs.writeFileAsync(path.default.join(destinationFolder, CACHE_FILENAME), JSON.stringify(newCache));
}
async function toIniFileObject(data, tempDest) {
	try {
		await vortex_api.fs.writeFileAsync(tempDest, data, { encoding: "utf8" });
		const iniData = await new IniParser.default(new IniParser.WinapiFormat()).read(tempDest);
		await vortex_api.fs.removeAsync(tempDest);
		return Promise.resolve(iniData);
	} catch (err) {
		return Promise.reject(err);
	}
}
async function onDidDeploy$1(api, deployment, activeProfile) {
	const state = api.store.getState();
	const loadOrder = getPersistentLoadOrder(api);
	const docFiles = deployment["witcher3menumodroot"].filter((file) => file.relPath.endsWith(PART_SUFFIX) && file.relPath.indexOf(INPUT_XML_FILENAME) === -1);
	if (docFiles.length <= 0) return;
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID
	], {});
	const modState = vortex_api.util.getSafe(activeProfile, ["modState"], {});
	let nextAvailableId = loadOrder.length;
	const getNextId = () => {
		return nextAvailableId++;
	};
	const invalidModTypes = ["witcher3menumoddocuments"];
	const enabledMods = Object.keys(mods).filter((key) => !!modState[key]?.enabled && !invalidModTypes.includes(mods[key].type)).sort((lhs, rhs) => (loadOrder[rhs]?.pos || getNextId()) - (loadOrder[lhs]?.pos || getNextId()));
	const currentCache = await getExistingCache(state, activeProfile);
	const inCache = new Set(currentCache.map((entry) => entry.id));
	const notInCache = new Set(docFiles.map((file) => file.source).filter((modId) => !inCache.has(modId)));
	return ensureMenuMod(api, activeProfile).then(() => currentCache.length === 0 && enabledMods.length > 0 ? populateCache(api, activeProfile) : notInCache.size !== 0 ? populateCache(api, activeProfile, Array.from(notInCache), currentCache) : Promise.resolve()).then(() => writeCacheToFiles(api, activeProfile)).then(() => menuMod(activeProfile.name)).catch((err) => err instanceof vortex_api.util.UserCanceled ? Promise.resolve() : Promise.reject(err));
}
function sanitizeProfileName(input) {
	return input.replace(INVALID_CHARS, "_");
}
function menuMod(profileName) {
	return `Witcher 3 Menu Mod Data (${sanitizeProfileName(profileName)})`;
}
async function createMenuMod(api, modName, profile) {
	const mod = {
		id: modName,
		state: "installed",
		attributes: {
			name: "Witcher 3 Menu Mod",
			description: "This mod is a collective merge of setting files required by any/all menu mods the user has installed - please do not disable/remove unless all menu mods have been removed from your game first.",
			logicalFileName: "Witcher 3 Menu Mod",
			modId: 42,
			version: "1.0.0",
			variant: sanitizeProfileName(profile.name.replace(INVALID_CHARS, "_")),
			installTime: /* @__PURE__ */ new Date()
		},
		installationPath: modName,
		type: "witcher3menumoddocuments"
	};
	return await new Promise((resolve, reject) => {
		api.events.emit("create-mod", profile.gameId, mod, async (error) => {
			if (error !== null) return reject(error);
			resolve();
		});
	});
}
async function removeMenuMod(api, profile) {
	const state = api.store.getState();
	const modName = menuMod(profile.name);
	const mod = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		profile.gameId,
		modName
	], void 0);
	if (mod === void 0) return Promise.resolve();
	return new Promise((resolve, reject) => {
		api.events.emit("remove-mod", profile.gameId, mod.id, async (error) => {
			if (error !== null) (0, vortex_api.log)("error", "failed to remove menu mod", error);
			return resolve();
		});
	});
}
async function cacheToFileMap(state, profile) {
	const currentCache = await getExistingCache(state, profile);
	if (currentCache.length === 0) return;
	const stagingFolder = vortex_api.selectors.installPathForGame(state, GAME_ID);
	return currentCache.reduce((accum, entry) => {
		accum[toFileMapKey(entry.filepath)] = [].concat(accum[toFileMapKey(entry.filepath)] || [], [{
			id: entry.id,
			data: entry.data,
			filepath: convertFilePath(entry.filepath, stagingFolder)
		}]);
		return accum;
	}, {});
}
const copyIniFile = (source, dest) => vortex_api.fs.copyAsync(source, dest).then(() => Promise.resolve(dest)).catch((err) => Promise.resolve(void 0));
const getInitialDoc = (filePath) => {
	return vortex_api.fs.statAsync(filePath + BACKUP_TAG).then(() => Promise.resolve(filePath + BACKUP_TAG)).catch((err) => vortex_api.fs.statAsync(filePath).then(() => Promise.resolve(filePath))).catch((err) => {
		(0, vortex_api.log)("warn", "W3: cannot find original file", err.message);
		return Promise.resolve(void 0);
	});
};
async function writeCacheToFiles(api, profile) {
	const state = api.store.getState();
	const modName = menuMod(profile.name);
	const installPath = vortex_api.selectors.installPathForGame(state, profile.gameId);
	const destinationFolder = path.default.join(installPath, modName);
	const game = vortex_api.util.getGame(profile.gameId);
	const discovery = vortex_api.selectors.discoveryByGame(state, profile.gameId);
	const docModPath = game.getModPaths(discovery.path)["witcher3menumoddocuments"];
	if ((await getExistingCache(state, profile)).length === 0) return;
	const fileMap = await cacheToFileMap(state, profile);
	if (!fileMap) return;
	const parser = new IniParser.default(new IniParser.WinapiFormat());
	const keys = Object.keys(fileMap);
	for (const key of keys) try {
		const source = await getInitialDoc(path.default.join(docModPath, key));
		if (!source) continue;
		await copyIniFile(source, path.default.join(destinationFolder, key));
		const initialData = await parser.read(path.default.join(destinationFolder, key));
		for (const modEntry of fileMap[key]) {
			const tempFilePath = path.default.join(destinationFolder, key) + (0, shortid.generate)();
			const modData = await toIniFileObject(modEntry.data, tempFilePath);
			for (const modKey of Object.keys(modData.data)) initialData.data[modKey] = {
				...initialData.data[modKey],
				...modData.data[modKey]
			};
		}
		await parser.write(path.default.join(destinationFolder, key), initialData);
	} catch (err) {
		if (err.code === "ENOENT" && [
			path.default.join(docModPath, INPUT_SETTINGS_FILENAME),
			path.default.join(docModPath, DX_11_USER_SETTINGS_FILENAME),
			path.default.join(docModPath, DX_12_USER_SETTINGS_FILENAME)
		].includes(err.path)) {
			api.showErrorNotification("Failed to install menu mod", new vortex_api.util.DataInvalid("Required setting files are missing - please run the game at least once and try again."), { allowReport: false });
			return;
		}
		throw err;
	}
}
async function ensureMenuMod(api, profile) {
	const state = api.store.getState();
	const modName = menuMod(profile.name);
	if (vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		profile.gameId,
		modName
	], void 0) === void 0) try {
		await createMenuMod(api, modName, profile);
	} catch (err) {
		return Promise.reject(err);
	}
	else {
		api.store.dispatch(vortex_api.actions.setModAttribute(profile.gameId, modName, "installTime", /* @__PURE__ */ new Date()));
		api.store.dispatch(vortex_api.actions.setModAttribute(profile.gameId, modName, "name", "Witcher 3 Menu Mod"));
		api.store.dispatch(vortex_api.actions.setModAttribute(profile.gameId, modName, "type", "witcher3menumoddocuments"));
		api.store.dispatch(vortex_api.actions.setModAttribute(profile.gameId, modName, "logicalFileName", "Witcher 3 Menu Mod"));
		api.store.dispatch(vortex_api.actions.setModAttribute(profile.gameId, modName, "modId", 42));
		api.store.dispatch(vortex_api.actions.setModAttribute(profile.gameId, modName, "version", "1.0.0"));
		api.store.dispatch(vortex_api.actions.setModAttribute(profile.gameId, modName, "variant", sanitizeProfileName(profile.name)));
	}
	return Promise.resolve(modName);
}
async function exportMenuMod(api, profile, includedMods) {
	try {
		const deployment = await getDeployment(api, includedMods);
		if (deployment === void 0) throw new Error("Failed to get deployment");
		const modName = await onDidDeploy$1(api, deployment, profile);
		if (modName === void 0) return;
		const mods = vortex_api.util.getSafe(api.getState(), [
			"persistent",
			"mods",
			GAME_ID
		], {});
		const modId = Object.keys(mods).find((id) => id === modName);
		if (modId === void 0) throw new Error("Menu mod is missing");
		const installPath = vortex_api.selectors.installPathForGame(api.getState(), GAME_ID);
		return await prepareFileData(path.default.join(installPath, mods[modId].installationPath));
	} catch (err) {
		return Promise.reject(err);
	}
}
async function importMenuMod(api, profile, fileData) {
	try {
		const modName = await ensureMenuMod(api, profile);
		const mod = vortex_api.util.getSafe(api.getState(), [
			"persistent",
			"mods",
			profile.gameId,
			modName
		], void 0);
		const installPath = vortex_api.selectors.installPathForGame(api.getState(), GAME_ID);
		await restoreFileData(fileData, path.default.join(installPath, mod.installationPath));
	} catch (err) {
		return Promise.reject(err);
	}
}

//#endregion
//#region extensions/games/game-witcher3/scriptmerger.ts
const RELEASE_CUTOFF = "0.6.5";
const GITHUB_URL = "https://api.github.com/repos/IDCs/WitcherScriptMerger";
const MERGER_RELPATH = "WitcherScriptMerger";
const MERGER_CONFIG_FILE = "WitcherScriptMerger.exe.config";
const { getHash, MD5ComparisonError, SCRIPT_MERGER_ID } = (init_common(), __toCommonJS(common_exports));
function query(baseUrl, request) {
	return new Promise((resolve, reject) => {
		const relUrl = url.default.parse(`${baseUrl}/${request}`);
		const options = {
			...lodash.default.pick(relUrl, [
				"port",
				"hostname",
				"path"
			]),
			headers: { "User-Agent": "Vortex" }
		};
		https.default.get(options, (res) => {
			res.setEncoding("utf-8");
			const headers = res.headers;
			const callsRemaining = parseInt(headers?.["x-ratelimit-remaining"], 10);
			if (res.statusCode === 403 && callsRemaining === 0) {
				const resetDate = parseInt(headers?.["x-ratelimit-reset"], 10) * 1e3;
				(0, vortex_api.log)("info", "GitHub rate limit exceeded", { reset_at: new Date(resetDate).toString() });
				return reject(new vortex_api.util.ProcessCanceled("GitHub rate limit exceeded"));
			}
			let output = "";
			res.on("data", (data) => output += data).on("end", () => {
				try {
					return resolve(JSON.parse(output));
				} catch (parseErr) {
					return reject(parseErr);
				}
			});
		}).on("error", (err) => {
			return reject(err);
		}).end();
	});
}
function getRequestOptions(link) {
	const relUrl = url.default.parse(link);
	return {
		...lodash.default.pick(relUrl, [
			"port",
			"hostname",
			"path"
		]),
		headers: { "User-Agent": "Vortex" }
	};
}
async function downloadConsent(api) {
	return new Promise((resolve, reject) => {
		api.showDialog("info", "Witcher 3 Script Merger", { bbcode: api.translate("Many Witcher 3 mods add or edit game scripts. When several mods editing the same script are installed, these mods need to be merged using a tool called Witcher 3 Script Merger. Vortex can attempt to download and configure the merger for you automatically - before doing so - please ensure your account has full read/write permissions to your game's directory. The script merger can be installed at a later point if you wish. [br][/br][br][/br][url=https://wiki.nexusmods.com/index.php/Tool_Setup:_Witcher_3_Script_Merger]find out more about the script merger.[/url][br][/br][br][/br]Note: While script merging works well with the vast majority of mods, there is no guarantee for a satisfying outcome in every single case.", { ns: "game-witcher3" }) }, [{
			label: "Cancel",
			action: () => reject(new vortex_api.util.UserCanceled())
		}, {
			label: "Download",
			action: () => resolve()
		}]);
	});
}
async function getMergerVersion(api) {
	const state = api.store.getState();
	const discovery = vortex_api.util.getSafe(state, [
		"settings",
		"gameMode",
		"discovered",
		"witcher3"
	], void 0);
	if (discovery?.path === void 0) return Promise.reject(new vortex_api.util.SetupError("Witcher3 is not discovered"));
	const merger = discovery?.tools?.W3ScriptMerger;
	if (merger === void 0) return Promise.resolve(void 0);
	if (!!merger?.path) return vortex_api.fs.statAsync(merger.path).then(() => {
		if (merger?.mergerVersion !== void 0) return Promise.resolve(merger.mergerVersion);
		const execVersion = (0, exe_version.default)(merger.path);
		if (!!execVersion) {
			const trimmedVersion = execVersion.split(".").slice(0, 3).join(".");
			const newToolDetails = {
				...merger,
				mergerVersion: trimmedVersion
			};
			api.store.dispatch(vortex_api.actions.addDiscoveredTool("witcher3", SCRIPT_MERGER_ID, newToolDetails, true));
			return Promise.resolve(trimmedVersion);
		}
	}).catch((err) => Promise.resolve(void 0));
	else return Promise.resolve(void 0);
}
let _HASH_CACHE;
async function getCache(api) {
	if (_HASH_CACHE === void 0) try {
		const data = await vortex_api.fs.readFileAsync(path.default.join(__dirname, "MD5Cache.json"), { encoding: "utf8" });
		_HASH_CACHE = JSON.parse(data);
	} catch (err) {
		api.showErrorNotification("Failed to parse MD5Cache", err);
		return _HASH_CACHE = [];
	}
	return _HASH_CACHE;
}
async function onDownloadComplete(api, archivePath, mostRecentVersion) {
	return new Promise(async (resolve, reject) => {
		let archiveHash;
		try {
			archiveHash = await getHash(archivePath);
		} catch (err) {
			return Promise.reject(new MD5ComparisonError("Failed to calculate hash", archivePath));
		}
		if ((await getCache(api)).find((entry) => entry.archiveChecksum.toLowerCase() === archiveHash && entry.version === mostRecentVersion) === void 0) return reject(new MD5ComparisonError("Corrupted archive download", archivePath));
		return resolve(archivePath);
	}).then((archivePath) => extractScriptMerger(api, archivePath)).then(async (mergerPath) => {
		const mergerExec = path.default.join(mergerPath, "WitcherScriptMerger.exe");
		let execHash;
		try {
			execHash = await getHash(mergerExec);
		} catch (err) {
			return Promise.reject(new MD5ComparisonError("Failed to calculate hash", mergerExec));
		}
		if ((await getCache(api)).find((entry) => entry.execChecksum.toLowerCase() === execHash && entry.version === mostRecentVersion) === void 0) return Promise.reject(new MD5ComparisonError("Corrupted executable", mergerExec));
		return Promise.resolve(mergerPath);
	}).then((mergerPath) => setUpMerger(api, mostRecentVersion, mergerPath));
}
async function getScriptMergerDir(api, create = false) {
	const state = api.getState();
	const discovery = vortex_api.util.getSafe(state, [
		"settings",
		"gameMode",
		"discovered",
		"witcher3"
	], void 0);
	if (discovery?.path === void 0) return;
	const currentPath = discovery.tools?.W3ScriptMerger?.path;
	try {
		if (!currentPath) throw new Error("Script Merger not set up");
		await vortex_api.fs.statAsync(currentPath);
		return currentPath;
	} catch (err) {
		const defaultPath = path.default.join(discovery.path, MERGER_RELPATH);
		if (create) await vortex_api.fs.ensureDirWritableAsync(defaultPath);
		return defaultPath;
	}
}
async function downloadScriptMerger(api) {
	const state = api.store.getState();
	const discovery = vortex_api.util.getSafe(state, [
		"settings",
		"gameMode",
		"discovered",
		"witcher3"
	], void 0);
	if (discovery?.path === void 0) return Promise.reject(new vortex_api.util.SetupError("Witcher3 is not discovered"));
	let mostRecentVersion;
	const currentlyInstalledVersion = await getMergerVersion(api);
	const downloadNotifId = "download-script-merger-notif";
	return query(GITHUB_URL, "releases").then((releases) => {
		if (!Array.isArray(releases)) return Promise.reject(new vortex_api.util.DataInvalid("expected array of github releases"));
		const current = releases.filter((rel) => semver.default.valid(rel.name) && semver.default.gte(rel.name, RELEASE_CUTOFF)).sort((lhs, rhs) => semver.default.compare(rhs.name, lhs.name));
		return Promise.resolve(current);
	}).then(async (currentRelease) => {
		mostRecentVersion = currentRelease[0].name;
		const fileName = currentRelease[0].assets[0].name;
		const downloadLink = currentRelease[0].assets[0].browser_download_url;
		if (!!currentlyInstalledVersion && semver.default.gte(currentlyInstalledVersion, currentRelease[0].name)) return Promise.reject(new vortex_api.util.ProcessCanceled("Already up to date"));
		const downloadNotif = {
			id: downloadNotifId,
			type: "activity",
			title: "Adding Script Merger",
			message: "This may take a minute..."
		};
		const download = async () => {
			api.sendNotification({
				...downloadNotif,
				progress: 0
			});
			let redirectionURL;
			redirectionURL = await new Promise((resolve, reject) => {
				const options = getRequestOptions(downloadLink);
				https.default.request(options, (res) => {
					return res.headers["location"] !== void 0 ? resolve(res.headers["location"]) : reject(new vortex_api.util.ProcessCanceled("Failed to resolve download location"));
				}).on("error", (err) => reject(err)).end();
			});
			return new Promise((resolve, reject) => {
				const options = getRequestOptions(redirectionURL);
				https.default.request(options, (res) => {
					res.setEncoding("binary");
					const headers = res.headers;
					const contentLength = parseInt(headers?.["content-length"], 10);
					const callsRemaining = parseInt(headers?.["x-ratelimit-remaining"], 10);
					if (res.statusCode === 403 && callsRemaining === 0) {
						const resetDate = parseInt(headers?.["x-ratelimit-reset"], 10) * 1e3;
						(0, vortex_api.log)("info", "GitHub rate limit exceeded", { reset_at: new Date(resetDate).toString() });
						return reject(new vortex_api.util.ProcessCanceled("GitHub rate limit exceeded"));
					}
					let output = "";
					res.on("data", (data) => {
						output += data;
						if (output.length % 500 === 0) api.sendNotification({
							...downloadNotif,
							progress: output.length / contentLength * 100
						});
					}).on("end", () => {
						api.sendNotification({
							...downloadNotif,
							progress: 100
						});
						api.dismissNotification(downloadNotifId);
						return vortex_api.fs.writeFileAsync(path.default.join(discovery.path, fileName), output, { encoding: "binary" }).then(() => resolve(path.default.join(discovery.path, fileName))).catch((err) => reject(err));
					});
				}).on("error", (err) => reject(err)).end();
			});
		};
		if (!!currentlyInstalledVersion || currentlyInstalledVersion === void 0 && !!discovery?.tools?.W3ScriptMerger) {
			api.sendNotification({
				id: "merger-update",
				type: "warning",
				noDismiss: true,
				message: api.translate("Important Script Merger update available", { ns: "game-witcher3" }),
				actions: [{
					title: "Download",
					action: (dismiss) => {
						dismiss();
						return download().then((archivePath) => onDownloadComplete(api, archivePath, mostRecentVersion)).catch((err) => {
							api.dismissNotification(extractNotifId);
							api.dismissNotification(downloadNotifId);
							if (err instanceof MD5ComparisonError || err instanceof vortex_api.util.ProcessCanceled) {
								(0, vortex_api.log)("error", "Failed to automatically install Script Merger", err.errorMessage);
								api.sendNotification({
									type: "error",
									message: api.translate("Please install Script Merger manually", { ns: "game-witcher3" }),
									actions: [{
										title: "Install Manually",
										action: () => vortex_api.util.opn("https://www.nexusmods.com/witcher3/mods/484").catch((err) => null)
									}]
								});
								return Promise.resolve();
							}
							api.sendNotification({
								type: "info",
								message: api.translate("Update failed due temporary network issue - try again later", { ns: "game-witcher3" })
							});
							return Promise.resolve();
						});
					}
				}]
			});
			return Promise.reject(new vortex_api.util.ProcessCanceled("Update"));
		}
		return downloadConsent(api).then(() => download());
	}).then((archivePath) => onDownloadComplete(api, archivePath, mostRecentVersion)).catch(async (err) => {
		const raiseManualInstallNotif = () => {
			(0, vortex_api.log)("error", "Failed to automatically install Script Merger", err.errorMessage);
			api.sendNotification({
				type: "error",
				message: api.translate("Please install Script Merger manually", { ns: "game-witcher3" }),
				actions: [{
					title: "Install Manually",
					action: () => vortex_api.util.opn("https://www.nexusmods.com/witcher3/mods/484").catch((err) => null)
				}]
			});
		};
		api.dismissNotification(extractNotifId);
		api.dismissNotification(downloadNotifId);
		if (err instanceof MD5ComparisonError) {
			raiseManualInstallNotif();
			return Promise.resolve();
		}
		if (err instanceof vortex_api.util.UserCanceled) return Promise.resolve();
		else if (err instanceof vortex_api.util.ProcessCanceled) {
			if (err.message.startsWith("Already") || err.message.startsWith("Update")) return Promise.resolve();
			else if (err.message.startsWith("Failed to resolve download location")) {
				(0, vortex_api.log)("info", "failed to resolve W3 script merger re-direction link", err);
				return Promise.resolve();
			} else if (err.message.startsWith("Game is not discovered")) {
				raiseManualInstallNotif();
				return Promise.resolve();
			}
		} else return Promise.reject(err);
	});
}
const extractNotifId = "extracting-script-merger";
const extractNotif = {
	id: extractNotifId,
	type: "activity",
	title: "Extracting Script Merger"
};
async function extractScriptMerger(api, archivePath) {
	const destination = await getScriptMergerDir(api, true);
	if (destination === void 0) return Promise.reject(new vortex_api.util.ProcessCanceled("Game is not discovered"));
	const sZip = new vortex_api.util.SevenZip();
	api.sendNotification(extractNotif);
	await sZip.extractFull(archivePath, destination);
	api.sendNotification({
		type: "info",
		message: api.translate("W3 Script Merger extracted successfully", { ns: "game-witcher3" })
	});
	api.dismissNotification(extractNotifId);
	return Promise.resolve(destination);
}
async function setUpMerger(api, mergerVersion, newPath) {
	const state = api.store.getState();
	const discovery = vortex_api.util.getSafe(state, [
		"settings",
		"gameMode",
		"discovered",
		"witcher3"
	], void 0);
	const currentDetails = discovery?.tools?.W3ScriptMerger;
	const newToolDetails = !!currentDetails ? {
		...currentDetails,
		mergerVersion
	} : {
		id: SCRIPT_MERGER_ID,
		name: "W3 Script Merger",
		logo: "WitcherScriptMerger.jpg",
		executable: () => "WitcherScriptMerger.exe",
		requiredFiles: ["WitcherScriptMerger.exe"],
		mergerVersion
	};
	newToolDetails.path = path.default.join(newPath, "WitcherScriptMerger.exe");
	newToolDetails.workingDirectory = newPath;
	await setMergerConfig(discovery.path, newPath);
	api.store.dispatch(vortex_api.actions.addDiscoveredTool("witcher3", SCRIPT_MERGER_ID, newToolDetails, true));
	return Promise.resolve();
}
async function getMergedModName(scriptMergerPath) {
	const configFilePath = path.default.join(scriptMergerPath, MERGER_CONFIG_FILE);
	try {
		const MergedModName = ((await (0, xml2js.parseStringPromise)(await vortex_api.fs.readFileAsync(configFilePath, { encoding: "utf8" })))?.configuration?.appSettings?.[0]?.add)?.find((item) => item.$?.key === "MergedModName") ?? void 0;
		if (!!MergedModName?.$?.value) return MergedModName.$.value;
	} catch (err) {
		(0, vortex_api.log)("error", "failed to ascertain merged mod name - using \"mod0000_MergedFiles\"", err);
		return "mod0000_MergedFiles";
	}
}
async function setMergerConfig(gameRootPath, scriptMergerPath) {
	const findIndex = (nodes, id) => {
		return nodes?.findIndex((iter) => iter.$?.key === id) ?? void 0;
	};
	const configFilePath = path.default.join(scriptMergerPath, MERGER_CONFIG_FILE);
	try {
		const config = await (0, xml2js.parseStringPromise)(await vortex_api.fs.readFileAsync(configFilePath, { encoding: "utf8" }));
		const replaceElement = (id, replacement) => {
			const idx = findIndex(config?.configuration?.appSettings?.[0]?.add, id);
			if (idx !== void 0) config.configuration.appSettings[0].add[idx].$ = {
				key: id,
				value: replacement
			};
		};
		replaceElement("GameDirectory", gameRootPath);
		replaceElement("VanillaScriptsDirectory", path.default.join(gameRootPath, "content", "content0", "scripts"));
		replaceElement("ModsDirectory", path.default.join(gameRootPath, "mods"));
		const xml = new xml2js.Builder().buildObject(config);
		await vortex_api.fs.writeFileAsync(configFilePath, xml);
	} catch (err) {
		return;
	}
}

//#endregion
//#region extensions/games/game-witcher3/mergeBackup.ts
init_common();
const sortInc = (lhs, rhs) => lhs.length - rhs.length;
const sortDec = (lhs, rhs) => rhs.length - lhs.length;
function genBaseProps(api, profileId, force) {
	if (!profileId) return;
	const state = api.getState();
	const profile = vortex_api.selectors.profileById(state, profileId);
	if (profile?.gameId !== GAME_ID) return;
	if (!(force ? true : vortex_api.util.getSafe(state, [
		"persistent",
		"profiles",
		profileId,
		"features",
		"local_merges"
	], false))) return;
	const discovery = vortex_api.util.getSafe(state, [
		"settings",
		"gameMode",
		"discovered",
		GAME_ID
	], void 0);
	const scriptMergerTool = discovery?.tools?.[SCRIPT_MERGER_ID$1];
	if (!scriptMergerTool?.path) return;
	return {
		api,
		state,
		profile,
		scriptMergerTool,
		gamePath: discovery.path
	};
}
function getFileEntries(filePath) {
	let files = [];
	return (0, turbowalk.default)(filePath, (entries) => {
		const validEntries = entries.filter((entry) => !entry.isDirectory).map((entry) => entry.filePath);
		files = files.concat(validEntries);
	}, { recurse: true }).catch((err) => ["ENOENT", "ENOTFOUND"].includes(err.code) ? Promise.resolve() : Promise.reject(err)).then(() => Promise.resolve(files));
}
async function moveFile(from, to, fileName) {
	const src = path.default.join(from, fileName);
	const dest = path.default.join(to, fileName);
	try {
		await copyFile(src, dest);
	} catch (err) {
		return err.code !== "ENOENT" ? Promise.reject(err) : Promise.resolve();
	}
}
async function removeFile(filePath) {
	if (path.default.extname(filePath) === "") return;
	try {
		await vortex_api.fs.removeAsync(filePath);
	} catch (err) {
		return err.code === "ENOENT" ? Promise.resolve() : Promise.reject(err);
	}
}
async function copyFile(src, dest) {
	try {
		await vortex_api.fs.ensureDirWritableAsync(path.default.dirname(dest));
		await removeFile(dest);
		await vortex_api.fs.copyAsync(src, dest);
	} catch (err) {
		return Promise.reject(err);
	}
}
async function moveFiles(src, dest, props) {
	const t = props.api.translate;
	const removeDestFiles = async () => {
		try {
			const destFiles = await getFileEntries(dest);
			destFiles.sort(sortDec);
			for (const destFile of destFiles) await vortex_api.fs.removeAsync(destFile);
		} catch (err) {
			if (["EPERM"].includes(err.code)) return props.api.showDialog("error", "Failed to restore merged files", { bbcode: t("Vortex encountered a permissions related error while attempting to replace:{{bl}}\"{{filePath}}\"{{bl}}Please try to resolve any permissions related issues and return to this dialog when you think you managed to fix it. There are a couple of things you can try to fix this:[br][/br][list][*] Close/Disable any applications that may interfere with Vortex's operations such as the game itself, the witcher script merger, any external modding tools, any anti-virus software. [*] Ensure that your Windows user account has full read/write permissions to the file specified [/list]", { replace: {
				filePath: err.path,
				bl: "[br][/br][br][/br]"
			} }) }, [{
				label: "Cancel",
				action: () => Promise.reject(new vortex_api.util.UserCanceled())
			}, {
				label: "Try Again",
				action: () => removeDestFiles()
			}]);
			else return Promise.reject(new vortex_api.util.ProcessCanceled(err.message));
		}
	};
	await removeDestFiles();
	const copied = [];
	try {
		const srcFiles = await getFileEntries(src);
		srcFiles.sort(sortInc);
		for (const srcFile of srcFiles) {
			const relPath = path.default.relative(src, srcFile);
			const targetPath = path.default.join(dest, relPath);
			try {
				await copyFile(srcFile, targetPath);
				copied.push(targetPath);
			} catch (err) {
				(0, vortex_api.log)("error", "failed to move file", err);
			}
		}
	} catch (err) {
		if (!!err.path && !err.path.includes(dest)) return;
		copied.sort(sortDec);
		for (const link of copied) await vortex_api.fs.removeAsync(link);
	}
}
function backupPath(profile) {
	return path.default.join(vortex_api.util.getVortexPath("userData"), profile.gameId, "profiles", profile.id, "backup");
}
async function handleMergedScripts(props, opType, dest) {
	const { scriptMergerTool, profile, gamePath } = props;
	if (!scriptMergerTool?.path) return Promise.reject(new vortex_api.util.NotFound("Script merging tool path"));
	if (!profile?.id) return Promise.reject(new vortex_api.util.ArgumentInvalid("invalid profile"));
	try {
		const mergerToolDir = path.default.dirname(scriptMergerTool.path);
		const profilePath = dest === void 0 ? path.default.join(mergerToolDir, profile.id) : dest;
		const loarOrderFilepath = getLoadOrderFilePath();
		const mergedModName = await getMergedModName(mergerToolDir);
		const mergedScriptsPath = path.default.join(gamePath, "Mods", mergedModName);
		await vortex_api.fs.ensureDirWritableAsync(mergedScriptsPath);
		if (opType === "export") {
			await moveFile(mergerToolDir, profilePath, MERGE_INV_MANIFEST);
			await moveFile(path.default.dirname(loarOrderFilepath), profilePath, path.default.basename(loarOrderFilepath));
			await moveFiles(mergedScriptsPath, path.default.join(profilePath, mergedModName), props);
		} else if (opType === "import") {
			await moveFile(profilePath, mergerToolDir, MERGE_INV_MANIFEST);
			await moveFile(profilePath, path.default.dirname(loarOrderFilepath), path.default.basename(loarOrderFilepath));
			await moveFiles(path.default.join(profilePath, mergedModName), mergedScriptsPath, props);
		}
		return Promise.resolve();
	} catch (err) {
		(0, vortex_api.log)("error", "failed to store/restore merged scripts", err);
		return Promise.reject(err);
	}
}
async function storeToProfile(api, profileId) {
	const props = genBaseProps(api, profileId);
	if (props === void 0) return;
	const bakPath = backupPath(props.profile);
	try {
		await handleMergedScripts(props, "export", bakPath);
	} catch (err) {
		return Promise.reject(err);
	}
	return handleMergedScripts(props, "export");
}
async function restoreFromProfile(api, profileId) {
	const props = genBaseProps(api, profileId);
	if (props === void 0) return;
	const bakPath = backupPath(props.profile);
	try {
		await handleMergedScripts(props, "import", bakPath);
	} catch (err) {
		return Promise.reject(err);
	}
	return handleMergedScripts(props, "import");
}
async function queryScriptMerges(api, includedModIds, collection) {
	const state = api.getState();
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID
	], {});
	const modTypes = vortex_api.selectors.modPathsForGame(state, GAME_ID);
	const deployment = await getDeployment(api, includedModIds);
	const deployedNames = Object.keys(modTypes).reduce((accum, typeId) => {
		const modPath = modTypes[typeId];
		const files = deployment[typeId];
		const isRootMod = modPath.toLowerCase().split(path.default.sep).indexOf("mods") === -1;
		const names = files.map((file) => {
			const nameSegments = file.relPath.split(path.default.sep);
			if (isRootMod) {
				const nameIdx = nameSegments.map((seg) => seg.toLowerCase()).indexOf("mods") + 1;
				return nameIdx > 0 ? nameSegments[nameIdx] : void 0;
			} else return nameSegments[0];
		});
		accum = accum.concat(names.filter((name) => !!name));
		return accum;
	}, []);
	const uniqueDeployed = Array.from(new Set(deployedNames));
	const merged = await getNamesOfMergedMods(api);
	const diff = lodash.default.difference(merged, uniqueDeployed);
	const isOptional = (modId) => (collection.rules ?? []).find((rule) => {
		const mod = mods[modId];
		if (mod === void 0) return false;
		if (!["recommends"].includes(rule.type)) return false;
		return vortex_api.util.testModReference(mod, rule.reference);
	}) !== void 0;
	const optionalMods = includedModIds.filter(isOptional);
	if (optionalMods.length > 0 || diff.length !== 0) throw new MergeDataViolationError(diff || [], optionalMods || [], vortex_api.util.renderModName(collection));
}
async function exportScriptMerges(api, profileId, includedModIds, collection) {
	const props = genBaseProps(api, profileId, true);
	if (props === void 0) return;
	const exportMergedData = async () => {
		try {
			const tempPath = path.default.join(W3_TEMP_DATA_DIR, (0, shortid.generate)());
			await vortex_api.fs.ensureDirWritableAsync(tempPath);
			await handleMergedScripts(props, "export", tempPath);
			const data = await prepareFileData(tempPath);
			return Promise.resolve(data);
		} catch (err) {
			return Promise.reject(err);
		}
	};
	try {
		await queryScriptMerges(api, includedModIds, collection);
		return exportMergedData();
	} catch (err) {
		if (err instanceof MergeDataViolationError) {
			const violationError = err;
			const optional = violationError.Optional;
			const notIncluded = violationError.NotIncluded;
			const optionalSegment = optional.length > 0 ? "Marked as \"optional\" but need to be marked \"required\":{{br}}[list]" + optional.map((opt) => `[*]${opt}`) + "[/list]{{br}}" : "";
			const notIncludedSegment = notIncluded.length > 0 ? "No longer part of the collection and need to be re-added:{{br}}[list]" + notIncluded.map((ni) => `[*]${ni}`) + "[/list]{{br}}" : "";
			return api.showDialog("question", "Potential merged data mismatch", {
				bbcode: `Your collection includes a script merge that is referencing mods that are...{{bl}} ${notIncludedSegment}${optionalSegment}For the collection to function correctly you will need to address the above or re-run the Script Merger to remove traces of merges referencing these mods. Please, do only proceed to upload the collection/revision as is if you intend to upload the script merge as is and if the reference for the merge will e.g. be acquired from an external source as part of the collection.`,
				parameters: {
					br: "[br][/br]",
					bl: "[br][/br][br][/br]"
				}
			}, [{ label: "Cancel" }, { label: "Upload Collection" }]).then((res) => res.action === "Cancel" ? Promise.reject(new vortex_api.util.UserCanceled()) : exportMergedData());
		}
		return Promise.reject(err);
	}
}
async function importScriptMerges(api, profileId, fileData) {
	const props = genBaseProps(api, profileId, true);
	if (props === void 0) return;
	if ((await api.showDialog("question", "Script Merges Import", { text: "The collection you are importing contains script merges which the creator of the collection deemed necessary for the mods to function correctly. Please note that importing these will overwrite any existing script merges you may have effectuated. Please ensure to back up any existing merges (if applicable/required) before proceeding." }, [{ label: "Cancel" }, { label: "Import Merges" }], "import-w3-script-merges-warning")).action === "Cancel") return Promise.reject(new vortex_api.util.UserCanceled());
	try {
		const tempPath = path.default.join(W3_TEMP_DATA_DIR, (0, shortid.generate)());
		await vortex_api.fs.ensureDirWritableAsync(tempPath);
		const data = await restoreFileData(fileData, tempPath);
		await handleMergedScripts(props, "import", tempPath);
		api.sendNotification({
			message: "Script merges imported successfully",
			id: "witcher3-script-merges-status",
			type: "success"
		});
		return data;
	} catch (err) {
		return Promise.reject(err);
	}
}
async function makeOnContextImport(api, collectionId) {
	const state = api.getState();
	const collectionMod = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID
	], {})[collectionId];
	if (collectionMod?.installationPath === void 0) {
		(0, vortex_api.log)("error", "collection mod is missing", collectionId);
		return;
	}
	const stagingFolder = vortex_api.selectors.installPathForGame(state, GAME_ID);
	try {
		const fileData = await vortex_api.fs.readFileAsync(path.default.join(stagingFolder, collectionMod.installationPath, "collection.json"), { encoding: "utf8" });
		const { scriptMergedData } = JSON.parse(fileData).mergedData;
		if (scriptMergedData !== void 0) {
			if (vortex_api.util.getSafe(state, [
				"settings",
				"gameMode",
				"discovered",
				GAME_ID,
				"tools",
				SCRIPT_MERGER_ID$1
			], void 0) === void 0) await downloadScriptMerger(api);
			await importScriptMerges(api, vortex_api.selectors.lastActiveProfileForGame(state, GAME_ID), hex2Buffer(scriptMergedData));
		}
	} catch (err) {
		if (!(err instanceof vortex_api.util.UserCanceled)) api.showErrorNotification("Failed to import script merges", err);
	}
}

//#endregion
//#region extensions/games/game-witcher3/collections/collections.ts
init_common();
async function genCollectionsData(context, gameId, includedMods, collection) {
	const api = context.api;
	const state = api.getState();
	const profile = vortex_api.selectors.activeProfile(state);
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		gameId
	], {});
	try {
		const loadOrder = await exportLoadOrder(api, includedMods, mods);
		const menuModData = await exportMenuMod(api, profile, includedMods);
		const scriptMergerTool = vortex_api.util.getSafe(state, [
			"settings",
			"gameMode",
			"discovered",
			GAME_ID,
			"tools",
			SCRIPT_MERGER_ID$1
		], void 0);
		let scriptMergesData;
		if (scriptMergerTool !== void 0) scriptMergesData = await exportScriptMerges(context.api, profile.id, includedMods, collection);
		const collectionData = {
			loadOrder,
			mergedData: {
				menuModSettingsData: menuModData !== void 0 ? menuModData.toString("hex") : void 0,
				scriptMergedData: scriptMergesData !== void 0 ? scriptMergesData.toString("hex") : void 0
			}
		};
		return Promise.resolve(collectionData);
	} catch (err) {
		return Promise.reject(err);
	}
}
async function parseCollectionsData(context, gameId, collection) {
	const api = context.api;
	const state = api.getState();
	const profileId = vortex_api.selectors.lastActiveProfileForGame(state, gameId);
	const profile = vortex_api.selectors.profileById(state, profileId);
	if (profile?.gameId !== gameId) {
		const collectionName = collection["info"]?.["name"] !== void 0 ? collection["info"]["name"] : "Witcher 3 Collection";
		return Promise.reject(new CollectionParseError(collectionName, "Last active profile is missing"));
	}
	const { menuModSettingsData, scriptMergedData } = collection.mergedData;
	try {
		await importLoadOrder$1(api, collection);
		if (menuModSettingsData !== void 0) await importMenuMod(api, profile, hex2Buffer(menuModSettingsData));
		if (scriptMergedData !== void 0) {
			if (vortex_api.util.getSafe(state, [
				"settings",
				"gameMode",
				"discovered",
				GAME_ID,
				"tools",
				SCRIPT_MERGER_ID$1
			], void 0) === void 0) await downloadScriptMerger(api);
			await importScriptMerges(context.api, profile.id, hex2Buffer(scriptMergedData));
		}
	} catch (err) {
		return Promise.reject(err);
	}
}

//#endregion
//#region extensions/games/game-witcher3/views/CollectionsDataView.tsx
const NAMESPACE = "generic-load-order-extension";
var CollectionsDataView = class extends vortex_api.ComponentEx {
	static getDerivedStateFromProps(newProps, state) {
		const { loadOrder, mods, collection } = newProps;
		const sortedMods = genCollectionLoadOrder(loadOrder, mods, collection);
		return sortedMods !== state.sortedMods ? { sortedMods } : null;
	}
	constructor(props) {
		super(props);
		this.renderLoadOrderEditInfo = () => {
			const { t } = this.props;
			return /* @__PURE__ */ react.createElement(vortex_api.FlexLayout, {
				type: "row",
				id: "collection-edit-loadorder-edit-info-container"
			}, /* @__PURE__ */ react.createElement(vortex_api.FlexLayout.Fixed, { className: "loadorder-edit-info-icon" }, /* @__PURE__ */ react.createElement(vortex_api.Icon, { name: "dialog-info" })), /* @__PURE__ */ react.createElement(vortex_api.FlexLayout.Fixed, { className: "collection-edit-loadorder-edit-info" }, t("You can make changes to this data from the "), /* @__PURE__ */ react.createElement("a", {
				className: "fake-link",
				onClick: this.openLoadOrderPage,
				title: t("Go to Load Order Page")
			}, t("Load Order page.")), t(" If you believe a load order entry is missing, please ensure the relevant mod is enabled and has been added to the collection.")));
		};
		this.openLoadOrderPage = () => {
			this.context.api.events.emit("show-main-page", "generic-loadorder");
		};
		this.renderOpenLOButton = () => {
			const { t } = this.props;
			return /* @__PURE__ */ react.createElement(react_bootstrap.Button, {
				id: "btn-more-mods",
				className: "collection-add-mods-btn",
				onClick: this.openLoadOrderPage,
				bsStyle: "ghost"
			}, t("Open Load Order Page"));
		};
		this.renderPlaceholder = () => {
			const { t } = this.props;
			return /* @__PURE__ */ react.createElement(vortex_api.EmptyPlaceholder, {
				icon: "sort-none",
				text: t("You have no load order entries (for the current mods in the collection)"),
				subtext: this.renderOpenLOButton()
			});
		};
		this.renderModEntry = (loEntry, index) => {
			const key = loEntry.modId + JSON.stringify(loEntry);
			const name = loEntry.modId ? `${vortex_api.util.renderModName(this.props.mods[loEntry.modId]) ?? loEntry.id} (${loEntry.name})` : loEntry.name ?? loEntry.id;
			return /* @__PURE__ */ react.createElement(react_bootstrap.ListGroupItem, {
				key,
				className: ["load-order-entry", "collection-tab"].join(" ")
			}, /* @__PURE__ */ react.createElement(vortex_api.FlexLayout, { type: "row" }, /* @__PURE__ */ react.createElement("p", { className: "load-order-index" }, index + 1), /* @__PURE__ */ react.createElement("p", null, name)));
		};
		const { loadOrder, mods, collection } = props;
		this.initState({ sortedMods: genCollectionLoadOrder(loadOrder, mods, collection) || [] });
	}
	componentDidMount() {
		const { loadOrder, mods, collection } = this.props;
		this.nextState.sortedMods = genCollectionLoadOrder(loadOrder, mods, collection);
	}
	render() {
		const { t } = this.props;
		const { sortedMods } = this.state;
		return !!sortedMods && sortedMods.length !== 0 ? /* @__PURE__ */ react.createElement("div", { style: { overflow: "auto" } }, /* @__PURE__ */ react.createElement("h4", null, t("Witcher 3 Merged Data")), /* @__PURE__ */ react.createElement("p", null, t("The Witcher 3 game extension executes a series of file merges for UI/menu mods whenever the mods are deployed - these will be included in the collection. (separate from the ones done using the script merger utility) To ensure that Vortex includes the correct data when uploading this collection, please make sure that the mods are enabled and deployed before attempting to upload the collection.")), /* @__PURE__ */ react.createElement("p", null, t("Additionally - please remember that any script merges (if applicable) done through the script merger utility, should be reviewed before uploading, to only include merges that are necessary for the collection to function correctly. Merged scripts referencing a mod that is not included in your collection will most definitively cause the game to crash!")), /* @__PURE__ */ react.createElement("h4", null, t("Load Order")), /* @__PURE__ */ react.createElement("p", null, t("This is a snapshot of the load order information that will be exported with this collection.")), this.renderLoadOrderEditInfo(), /* @__PURE__ */ react.createElement(react_bootstrap.ListGroup, { id: "collections-load-order-list" }, sortedMods.map(this.renderModEntry))) : this.renderPlaceholder();
	}
};
function mapStateToProps$1(state, ownProps) {
	const profile = vortex_api.selectors.activeProfile(state) || void 0;
	let loadOrder = [];
	if (!!profile?.gameId) loadOrder = vortex_api.util.getSafe(state, [
		"persistent",
		"loadOrder",
		profile.id
	], []);
	return {
		gameId: profile?.gameId,
		loadOrder,
		mods: vortex_api.util.getSafe(state, [
			"persistent",
			"mods",
			profile.gameId
		], {}),
		profile
	};
}
var CollectionsDataView_default = (0, react_i18next.withTranslation)(["common", NAMESPACE])((0, react_redux.connect)(mapStateToProps$1)(CollectionsDataView));

//#endregion
//#region extensions/games/game-witcher3/modTypes.ts
init_common();
const destHasRootDir = (instruction, dir) => {
	if (!instruction?.destination) return false;
	return instruction.destination.split(path.default.sep)[0].toLowerCase() === dir.toLowerCase();
};
function testTL(instructions) {
	const hasConfigMatrix = instructions.some((instr) => !!instr.source && instr.source.indexOf(CONFIG_MATRIX_REL_PATH) !== -1);
	const hasSettingsConfig = instructions.some((instr) => instr?.source?.toLowerCase?.()?.endsWith?.(PART_SUFFIX));
	if (hasConfigMatrix || hasSettingsConfig) return Promise.resolve(false);
	const hasModsDir = instructions.some((instr) => destHasRootDir(instr, "mods"));
	const hasBinDir = instructions.some((instr) => destHasRootDir(instr, "bin"));
	return Promise.resolve(hasModsDir || hasBinDir);
}
function testDLC(instructions) {
	return Promise.resolve(instructions.find((instruction) => !!instruction.destination && instruction.destination.toLowerCase().startsWith("dlc" + path.default.sep)) !== void 0);
}

//#endregion
//#region extensions/games/game-witcher3/mergers.ts
init_common();
var ModXMLDataInvalid = class extends vortex_api.util.DataInvalid {
	constructor(message, modFilePath) {
		super(`${message}:\n${modFilePath}`);
	}
};
const doMergeXML = (api) => async (modFilePath, targetMergeDir) => {
	try {
		const modGroups = (await (0, xml2js.parseStringPromise)(await vortex_api.fs.readFileAsync(modFilePath)))?.UserConfig?.Group;
		if (!modGroups) {
			const err = new ModXMLDataInvalid("Invalid XML data - inform mod author", modFilePath);
			api.showErrorNotification("Failed to merge XML data", err, { allowReport: false });
			return Promise.resolve();
		}
		const currentInputFile = await readXMLInputFile(api, modFilePath, targetMergeDir);
		if (!currentInputFile) return Promise.resolve();
		const mergedXmlData = await (0, xml2js.parseStringPromise)(currentInputFile);
		modGroups.forEach((modGroup) => {
			const gameGroups = mergedXmlData?.UserConfig?.Group;
			const modVars = modGroup?.VisibleVars?.[0]?.Var;
			const gameGroup = gameGroups.find((group) => group?.$?.id === modGroup?.$?.id);
			if (gameGroup) {
				const gameVars = gameGroup?.VisibleVars?.[0]?.Var;
				modVars.forEach((modVar) => {
					const gameVar = gameVars.find((v) => v?.$?.id === modVar?.$?.id);
					if (gameVar) Object.assign(gameVar, modVar);
					else gameVars.push(modVar);
				});
			} else gameGroups.push(modGroup);
		});
		const xml = new xml2js.Builder({ doctype: { dtd: "UTF-16" } }).buildObject(mergedXmlData);
		await vortex_api.fs.ensureDirWritableAsync(path.default.join(targetMergeDir, CONFIG_MATRIX_REL_PATH));
		return vortex_api.fs.writeFileAsync(path.default.join(targetMergeDir, CONFIG_MATRIX_REL_PATH, path.default.basename(modFilePath)), xml);
	} catch (err) {
		const activeProfile = vortex_api.selectors.activeProfile(api.store.getState());
		if (!activeProfile?.id) {
			api.showErrorNotification("Failed to merge XML data", "No active profile found", { allowReport: false });
			return Promise.resolve();
		}
		const loadOrder = getPersistentLoadOrder(api);
		const extendedErr = vortex_api.util.deepMerge({
			modFilePath,
			targetMergeDir,
			message: err.message,
			stack: err.stack
		}, err);
		api.showErrorNotification("Failed to merge XML data", extendedErr, {
			allowReport: true,
			attachments: [{
				id: `${activeProfile.id}_loadOrder`,
				type: "data",
				data: loadOrder,
				description: "Current load order"
			}]
		});
		return Promise.resolve();
	}
};
const canMergeXML = (api) => {
	return (game, gameDiscovery) => {
		if (game.id !== GAME_ID) return;
		return {
			baseFiles: (deployedFiles) => deployedFiles.filter((file) => isXML(file.relPath)).map((file) => ({
				in: path.default.join(gameDiscovery.path, CONFIG_MATRIX_REL_PATH, file.relPath),
				out: path.default.join(CONFIG_MATRIX_REL_PATH, file.relPath)
			})),
			filter: (filePath) => isXML(filePath) && CONFIG_MATRIX_FILES.includes(path.default.basename(filePath, path.default.extname(filePath)))
		};
	};
};
async function readXMLInputFile(api, modFilePath, mergeDirPath) {
	const state = api.store.getState();
	const discovery = vortex_api.util.getSafe(state, [
		"settings",
		"gameMode",
		"discovered",
		GAME_ID
	], void 0);
	if (!discovery?.path) return Promise.reject({
		code: "ENOENT",
		message: "Game is not discovered"
	});
	const gameInputFilepath = path.default.join(discovery.path, CONFIG_MATRIX_REL_PATH, path.default.basename(modFilePath));
	const mergedFilePath = path.default.join(mergeDirPath, CONFIG_MATRIX_REL_PATH, path.default.basename(modFilePath));
	const backupFilePath = gameInputFilepath + VORTEX_BACKUP_TAG;
	try {
		let inputFileData;
		if (await fileExists(mergedFilePath)) inputFileData = vortex_api.fs.readFileAsync(mergedFilePath);
		else if (await fileExists(backupFilePath)) inputFileData = vortex_api.fs.readFileAsync(backupFilePath);
		else inputFileData = vortex_api.fs.readFileAsync(gameInputFilepath);
		return inputFileData;
	} catch (err) {
		await api.showDialog("error", "Failed to read merged/native xml file", { text: "A native XML file is missing. Please verify your game files through the game store client." }, [{
			label: "Close",
			default: true
		}], "w3-xml-merge-fail");
		return Promise.resolve(null);
	}
}

//#endregion
//#region extensions/games/game-witcher3/views/InfoComponent.tsx
init_common();
function InfoComponent(props) {
	const { onToggleModsState } = props;
	const t = (0, react_i18next.useTranslation)(I18N_NAMESPACE).t;
	const toggleModsState = react.useCallback((enable) => {
		onToggleModsState(enable);
	}, [onToggleModsState]);
	return /* @__PURE__ */ react.createElement("div", { style: {
		display: "flex",
		flexDirection: "column",
		gap: "12px",
		marginRight: "16px"
	} }, /* @__PURE__ */ react.createElement("div", null, /* @__PURE__ */ react.createElement("p", null, t("You can adjust the load order for The Witcher 3 by dragging and dropping mods up or down on this page.  If you are using several mods that add scripts you may need to use the Witcher 3 Script merger. For more information see: ", { ns: I18N_NAMESPACE }), /* @__PURE__ */ react.createElement("a", { onClick: () => vortex_api.util.opn("https://wiki.nexusmods.com/index.php/Modding_The_Witcher_3_with_Vortex") }, t("Modding The Witcher 3 with Vortex.", { ns: I18N_NAMESPACE })))), /* @__PURE__ */ react.createElement("div", { style: { height: "80%" } }, /* @__PURE__ */ react.createElement("p", null, t("Please note:", { ns: I18N_NAMESPACE })), /* @__PURE__ */ react.createElement("ul", null, /* @__PURE__ */ react.createElement("li", null, t("For Witcher 3, the mod with the lowest index number (by default, the mod sorted at the top) overrides mods with a higher index number.", { ns: I18N_NAMESPACE })), /* @__PURE__ */ react.createElement("li", null, t("If you cannot see your mod in this load order, you may need to add it manually (see our wiki for details).", { ns: I18N_NAMESPACE })), /* @__PURE__ */ react.createElement("li", null, t("When managing menu mods, mod settings changed inside the game will be detected by Vortex as external changes - that is expected, choose to use the newer file and your settings will be made persistent.", { ns: I18N_NAMESPACE })), /* @__PURE__ */ react.createElement("li", null, t("Merges generated by the Witcher 3 Script merger must be loaded first and are locked in the first load order slot.", { ns: I18N_NAMESPACE }))), /* @__PURE__ */ react.createElement(react_bootstrap.Button, {
		onClick: () => toggleModsState(false),
		style: {
			marginBottom: "5px",
			width: "min-content"
		}
	}, t("Disable All")), /* @__PURE__ */ react.createElement("br", null), /* @__PURE__ */ react.createElement(react_bootstrap.Button, {
		onClick: () => toggleModsState(true),
		style: {
			marginBottom: "5px",
			width: "min-content"
		}
	}, t("Enable All "))));
}

//#endregion
//#region extensions/games/game-witcher3/views/ItemRenderer.tsx
init_common();
function ItemRenderer(props) {
	if (props?.item?.loEntry === void 0) return null;
	const stateProps = (0, react_redux.useSelector)(mapStateToProps);
	const dispatch = (0, react_redux.useDispatch)();
	const onSetLoadOrder = react.useCallback((profileId, loadOrder) => {
		dispatch(vortex_api.actions.setFBLoadOrder(profileId, loadOrder));
	}, [
		dispatch,
		stateProps.profile.id,
		stateProps.loadOrder
	]);
	return renderDraggable({
		...props,
		...stateProps,
		onSetLoadOrder
	});
}
function renderValidationError(props) {
	const { invalidEntries, loEntry } = props.item;
	const invalidEntry = invalidEntries !== void 0 ? invalidEntries.find((inv) => inv.id.toLowerCase() === loEntry.id.toLowerCase()) : void 0;
	return invalidEntry !== void 0 ? /* @__PURE__ */ react.createElement(vortex_api.tooltip.Icon, {
		className: "fblo-invalid-entry",
		name: "feedback-error",
		tooltip: invalidEntry.reason
	}) : null;
}
function renderViewModIcon(props) {
	const { item, mods } = props;
	if (isExternal(item.loEntry) || item.loEntry.modId === item.loEntry.name) return null;
	const context = react.useContext(vortex_api.MainContext);
	const [t] = (0, react_i18next.useTranslation)(I18N_NAMESPACE);
	const onClick = react.useCallback(() => {
		const { modId } = item.loEntry;
		const mod = mods?.[modId];
		if (mod === void 0) return;
		const batched = [vortex_api.actions.setAttributeFilter("mods", "name", vortex_api.util.renderModName(mod))];
		vortex_api.util.batchDispatch(context.api.store.dispatch, batched);
		context.api.events.emit("show-main-page", "Mods");
	}, [
		item,
		mods,
		context
	]);
	return item.loEntry.modId !== void 0 ? /* @__PURE__ */ react.createElement(vortex_api.tooltip.IconButton, {
		className: "witcher3-view-mod-icon",
		icon: "open-ext",
		tooltip: t("View source Mod"),
		onClick
	}) : null;
}
function renderExternalBanner(item) {
	const [t] = (0, react_i18next.useTranslation)(I18N_NAMESPACE);
	return isExternal(item) ? /* @__PURE__ */ react.createElement("div", { className: "load-order-unmanaged-banner" }, /* @__PURE__ */ react.createElement(vortex_api.Icon, {
		className: "external-caution-logo",
		name: "feedback-warning"
	}), /* @__PURE__ */ react.createElement("span", { className: "external-text-area" }, t("Not managed by Vortex"))) : null;
}
function renderDraggable(props) {
	const { loadOrder, className, item, profile } = props;
	const key = !!item?.loEntry?.name ? `${item.loEntry.name}` : `${item.loEntry.id}`;
	const context = react.useContext(vortex_api.MainContext);
	const dispatch = (0, react_redux.useDispatch)();
	loadOrder.findIndex((entry) => entry.id === item.loEntry.id) + 1;
	let classes = ["load-order-entry"];
	if (className !== void 0) classes = classes.concat(className.split(" "));
	if (isExternal(item.loEntry)) classes = classes.concat("external");
	const onStatusChange = react.useCallback((evt) => {
		const entry = {
			...item.loEntry,
			enabled: evt.target.checked
		};
		dispatch(vortex_api.actions.setFBLoadOrderEntry(profile.id, entry));
	}, [
		dispatch,
		profile,
		item
	]);
	const onApplyIndex = react.useCallback((idx) => {
		const { item, onSetLoadOrder, profile, loadOrder } = props;
		if (currentPosition(props) === idx) return;
		const entry = {
			...item.loEntry,
			index: idx
		};
		const newLO = loadOrder.filter((entry) => entry.id !== item.loEntry.id);
		newLO.splice(idx - 1, 0, entry);
		onSetLoadOrder(profile.id, newLO);
	}, [
		dispatch,
		profile,
		item
	]);
	const checkBox = () => item.displayCheckboxes ? /* @__PURE__ */ react.createElement(react_bootstrap.Checkbox, {
		className: "entry-checkbox",
		checked: item.loEntry.enabled,
		disabled: isLocked(item.loEntry),
		onChange: onStatusChange
	}) : null;
	const lock = () => isLocked(item.loEntry) ? /* @__PURE__ */ react.createElement(vortex_api.Icon, {
		className: "locked-entry-logo",
		name: "locked"
	}) : null;
	return /* @__PURE__ */ react.createElement(react_bootstrap.ListGroupItem, {
		key,
		className: classes.join(" "),
		ref: props.item.setRef
	}, /* @__PURE__ */ react.createElement(vortex_api.Icon, {
		className: "drag-handle-icon",
		name: "drag-handle"
	}), /* @__PURE__ */ react.createElement(vortex_api.LoadOrderIndexInput, {
		className: "load-order-index",
		api: context.api,
		item: item.loEntry,
		currentPosition: currentPosition(props),
		lockedEntriesCount: lockedEntriesCount(props),
		loadOrder,
		isLocked,
		onApplyIndex
	}), renderValidationError(props), /* @__PURE__ */ react.createElement("p", { className: "load-order-name" }, key), renderExternalBanner(item.loEntry), renderViewModIcon(props), checkBox(), lock());
}
function isLocked(item) {
	return [
		true,
		"true",
		"always"
	].includes(item.locked);
}
function isExternal(item) {
	return item.modId !== void 0 ? false : true;
}
const currentPosition = (props) => {
	const { item, loadOrder } = props;
	return loadOrder.findIndex((entry) => entry.id === item.loEntry.id) + 1;
};
const lockedEntriesCount = (props) => {
	const { loadOrder } = props;
	return loadOrder.filter((item) => isLocked(item)).length;
};
const empty = {};
function mapStateToProps(state) {
	const profile = vortex_api.selectors.activeProfile(state);
	return {
		profile,
		loadOrder: vortex_api.util.getSafe(state, [
			"persistent",
			"loadOrder",
			profile.id
		], []),
		modState: vortex_api.util.getSafe(profile, ["modState"], empty),
		mods: vortex_api.util.getSafe(state, [
			"persistent",
			"mods",
			GAME_ID
		], {})
	};
}

//#endregion
//#region extensions/games/game-witcher3/loadOrder.tsx
init_common();
var TW3LoadOrder = class {
	constructor(props) {
		this.readableNames = { [UNI_PATCH]: "Unification/Community Patch" };
		this.gameId = GAME_ID;
		this.clearStateOnPurge = true;
		this.toggleableEntries = true;
		this.noCollectionGeneration = true;
		this.usageInstructions = () => /* @__PURE__ */ react.default.createElement(InfoComponent, { onToggleModsState: props.onToggleModsState });
		this.customItemRenderer = (props) => {
			return /* @__PURE__ */ react.default.createElement(ItemRenderer, {
				className: props.className,
				item: props.item
			});
		};
		this.mApi = props.api;
		this.mPriorityManager = props.getPriorityManager();
		this.deserializeLoadOrder = this.deserializeLoadOrder.bind(this);
		this.serializeLoadOrder = this.serializeLoadOrder.bind(this);
		this.validate = this.validate.bind(this);
	}
	async serializeLoadOrder(loadOrder) {
		return IniStructure.getInstance(this.mApi, () => this.mPriorityManager).setINIStruct(loadOrder);
	}
	async deserializeLoadOrder() {
		const state = this.mApi.getState();
		if (vortex_api.selectors.activeProfile(state)?.id === void 0) return Promise.resolve([]);
		const findName = (entry) => {
			if (this.readableNames?.[entry.name] !== void 0) return this.readableNames[entry.name];
			if (entry.VK === void 0) return entry.name;
			const state = this.mApi.getState();
			const mod = vortex_api.util.getSafe(state, [
				"persistent",
				"mods",
				GAME_ID
			], {})[entry.VK];
			if (mod === void 0) return entry.name;
			return `${vortex_api.util.renderModName(mod)} (${entry.name})`;
		};
		try {
			const unsorted = await IniStructure.getInstance(this.mApi, () => this.mPriorityManager).readStructure();
			const entries = Object.keys(unsorted).sort((a, b) => unsorted[a].Priority - unsorted[b].Priority).reduce((accum, iter, idx) => {
				const entry = unsorted[iter];
				accum[iter.startsWith(LOCKED_PREFIX) ? "locked" : "regular"].push({
					id: iter,
					name: findName({
						name: iter,
						VK: entry.VK
					}),
					enabled: entry.Enabled === "1",
					modId: entry?.VK ?? iter,
					locked: iter.startsWith(LOCKED_PREFIX),
					data: { prefix: iter.startsWith(LOCKED_PREFIX) ? accum.locked.length : entry?.Priority ?? idx + 1 }
				});
				return accum;
			}, {
				locked: [],
				regular: []
			});
			const finalEntries = [].concat(entries.locked, entries.regular);
			return Promise.resolve(finalEntries);
		} catch (err) {
			return;
		}
	}
	async validate(prev, current) {
		return Promise.resolve(void 0);
	}
};
async function importLoadOrder(api, collectionId) {
	const state = api.getState();
	api.sendNotification({
		type: "activity",
		id: ACTIVITY_ID_IMPORTING_LOADORDER,
		title: "Importing Load Order",
		message: "Parsing collection data",
		allowSuppress: false,
		noDismiss: true
	});
	const collectionMod = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID
	], {})[collectionId];
	if (collectionMod?.installationPath === void 0) {
		api.dismissNotification(ACTIVITY_ID_IMPORTING_LOADORDER);
		api.showErrorNotification("collection mod is missing", collectionId);
		return;
	}
	const stagingFolder = vortex_api.selectors.installPathForGame(state, GAME_ID);
	try {
		api.sendNotification({
			type: "activity",
			id: ACTIVITY_ID_IMPORTING_LOADORDER,
			title: "Importing Load Order",
			message: "Ensuring mods are deployed...",
			allowSuppress: false,
			noDismiss: true
		});
		await vortex_api.util.toPromise((cb) => api.events.emit("deploy-mods", cb));
		const fileData = await vortex_api.fs.readFileAsync(path.default.join(stagingFolder, collectionMod.installationPath, "collection.json"), { encoding: "utf8" });
		const loadOrder = JSON.parse(fileData)?.loadOrder || {};
		if (Object.keys(loadOrder).length === 0) {
			api.sendNotification({
				type: "success",
				message: "Collection does not include load order to import",
				displayMS: 3e3
			});
			return;
		}
		const converted = getPersistentLoadOrder(api, loadOrder);
		api.sendNotification({
			type: "activity",
			id: ACTIVITY_ID_IMPORTING_LOADORDER,
			title: "Importing Load Order",
			message: "Writing Load Order...",
			allowSuppress: false,
			noDismiss: true
		});
		await IniStructure.getInstance().setINIStruct(converted).then(() => forceRefresh(api));
		api.sendNotification({
			type: "success",
			message: "Collection load order has been imported",
			displayMS: 3e3
		});
		return;
	} catch (err) {
		api.showErrorNotification("Failed to import load order", err);
		return;
	} finally {
		api.dismissNotification(ACTIVITY_ID_IMPORTING_LOADORDER);
	}
}

//#endregion
//#region extensions/games/game-witcher3/iconbarActions.ts
init_common();
const registerActions = (props) => {
	const { context } = props;
	const openTW3DocPath = () => {
		const docPath = path.default.join(vortex_api.util.getVortexPath("documents"), "The Witcher 3");
		vortex_api.util.opn(docPath).catch(() => null);
	};
	const isTW3 = (gameId = void 0) => {
		if (gameId !== void 0) return gameId === GAME_ID;
		const state = context.api.getState();
		return vortex_api.selectors.activeGameId(state) === GAME_ID;
	};
	context.registerAction("mods-action-icons", 300, "start-install", {}, "Import Script Merges", (instanceIds) => {
		makeOnContextImport(context.api, instanceIds[0]);
	}, (instanceIds) => {
		const state = context.api.getState();
		if (vortex_api.util.getSafe(state, [
			"persistent",
			"mods",
			GAME_ID
		], {})[instanceIds?.[0]]?.type !== "collection") return false;
		return vortex_api.selectors.activeGameId(state) === GAME_ID;
	});
	context.registerAction("mods-action-icons", 300, "start-install", {}, "Import Load Order", (instanceIds) => {
		importLoadOrder(context.api, instanceIds[0]);
	}, (instanceIds) => {
		const state = context.api.getState();
		if (vortex_api.util.getSafe(state, [
			"persistent",
			"mods",
			GAME_ID
		], {})[instanceIds?.[0]]?.type !== "collection") return false;
		return vortex_api.selectors.activeGameId(state) === GAME_ID;
	});
	context.registerAction("mod-icons", 300, "open-ext", {}, "Open TW3 Documents Folder", openTW3DocPath, isTW3);
	context.registerAction("fb-load-order-icons", 300, "open-ext", {}, "Open TW3 Documents Folder", openTW3DocPath, isTW3);
	context.registerAction("fb-load-order-icons", 100, "loot-sort", {}, "Sort by Deploy Order", () => {
		context.api.showDialog("info", "Sort by Deployment Order", { bbcode: context.api.translate("This action will set priorities using the deployment rules defined in the mods page. Are you sure you wish to proceed ?[br][/br][br][/br]Please be aware that any externally added mods (added manually or by other tools) will be pushed to the bottom of the list, while all mods that have been installed through Vortex will shift in position to match the deploy order!", { ns: I18N_NAMESPACE }) }, [{
			label: "Cancel",
			action: () => {}
		}, {
			label: "Sort by Deploy Order",
			action: () => {
				const state = context.api.getState();
				const gameMods = state.persistent.mods?.[GAME_ID] || {};
				const profile = vortex_api.selectors.activeProfile(state);
				const mods = Object.keys(gameMods).filter((key) => vortex_api.util.getSafe(profile, [
					"modState",
					key,
					"enabled"
				], false)).map((key) => gameMods[key]);
				const findIndex = (entry, modList) => {
					return modList.findIndex((m) => m.id === entry.modId);
				};
				return vortex_api.util.sortMods(GAME_ID, mods, context.api).then((sorted) => {
					const loadOrder = getPersistentLoadOrder(context.api);
					const filtered = loadOrder.filter((entry) => sorted.find((mod) => mod.id === entry.id) !== void 0);
					const sortedLO = filtered.sort((a, b) => findIndex(a, sorted) - findIndex(b, sorted));
					const locked = loadOrder.filter((entry) => entry.name.includes(LOCKED_PREFIX));
					const manuallyAdded = loadOrder.filter((key) => !filtered.includes(key) && !locked.includes(key));
					const newLO = [
						...locked,
						...sortedLO,
						...manuallyAdded
					].reduce((accum, entry, idx) => {
						accum.push({
							...entry,
							data: { prefix: idx + 1 }
						});
						return accum;
					}, []);
					context.api.store.dispatch(vortex_api.actions.setLoadOrder(profile.id, newLO));
				}).catch((err) => {
					const allowReport = !(err instanceof vortex_api.util.CycleError);
					context.api.showErrorNotification("Failed to sort by deployment order", err, { allowReport });
				}).finally(() => {
					forceRefresh(context.api);
				});
			}
		}]);
	}, () => {
		const state = context.api.store.getState();
		return vortex_api.selectors.activeGameId(state) === GAME_ID;
	});
};

//#endregion
//#region extensions/games/game-witcher3/priorityManager.ts
init_common();
var PriorityManager = class {
	constructor(api, priorityType) {
		this.resetMaxPriority = (min) => {
			const props = this.genProps(min);
			if (props === void 0) {
				this.mMaxPriority = 0;
				return;
			}
			this.mMaxPriority = this.getMaxPriority(props);
		};
		this.getPriority = (loadOrder, item) => {
			if (item === void 0) return ++this.mMaxPriority;
			const minPriority = Object.keys(loadOrder).filter((key) => loadOrder[key]?.locked).length + 1;
			const itemIdx = loadOrder.findIndex((x) => x?.id === item.id);
			if (itemIdx !== -1) if (this.mPriorityType === "position-based") {
				const position = itemIdx + 1;
				return position > minPriority ? position : ++this.mMaxPriority;
			} else {
				const prefixVal = loadOrder[itemIdx]?.data?.prefix ?? loadOrder[itemIdx]?.["prefix"];
				const intVal = prefixVal !== void 0 ? parseInt(prefixVal, 10) : itemIdx;
				const posVal = itemIdx;
				if (posVal !== intVal && intVal > minPriority) return intVal;
				else return posVal > minPriority ? posVal : ++this.mMaxPriority;
			}
			return ++this.mMaxPriority;
		};
		this.genProps = (min) => {
			const state = this.mApi.getState();
			const lastProfId = vortex_api.selectors.lastActiveProfileForGame(state, GAME_ID);
			if (lastProfId === void 0) return;
			const profile = vortex_api.selectors.profileById(state, lastProfId);
			if (profile === void 0) return;
			const loadOrder = getPersistentLoadOrder(this.mApi);
			const lockedEntries = Object.keys(loadOrder).filter((key) => loadOrder[key]?.locked);
			return {
				state,
				profile,
				loadOrder,
				minPriority: min ? min : lockedEntries.length
			};
		};
		this.getMaxPriority = (props) => {
			const { loadOrder, minPriority } = props;
			return Object.keys(loadOrder).reduce((prev, key) => {
				const intVal = (loadOrder[key]?.data?.prefix ?? loadOrder[key]?.prefix) !== void 0 ? parseInt(loadOrder[key].prefix, 10) : loadOrder[key].pos;
				const posVal = loadOrder[key].pos;
				if (posVal !== intVal) prev = intVal > prev ? intVal : prev;
				else prev = posVal > prev ? posVal : prev;
				return prev;
			}, minPriority);
		};
		this.mApi = api;
		this.mPriorityType = priorityType;
		this.resetMaxPriority();
	}
	set priorityType(type) {
		this.mPriorityType = type;
	}
	get priorityType() {
		return this.mPriorityType;
	}
};

//#endregion
//#region extensions/games/game-witcher3/installers.ts
init_common();
function scriptMergerTest(files, gameId) {
	const matcher = ((file) => SCRIPT_MERGER_FILES.includes(file));
	const supported = gameId === GAME_ID && files.filter(matcher).length > 0;
	return Promise.resolve({
		supported,
		requiredFiles: SCRIPT_MERGER_FILES
	});
}
function scriptMergerDummyInstaller() {
	return (api) => {
		api.showErrorNotification("Invalid Mod", "It looks like you tried to install The Witcher 3 Script Merger, which is a tool and not a mod for The Witcher 3.\n\nThe script merger should've been installed automatically by Vortex as soon as you activated this extension. If the download or installation has failed for any reason - please let us know why, by reporting the error through our feedback system and make sure to include vortex logs. Please note: if you've installed the script merger in previous versions of Vortex as a mod and STILL have it installed (it's present in your mod list) - you should consider un-installing it followed by a Vortex restart; the automatic merger installer/updater should then kick off and set up the tool for you.", { allowReport: false });
		return Promise.reject(new util.ProcessCanceled("Invalid mod"));
	};
}
function testMenuModRoot(instructions, gameId) {
	const hasMenuModPattern = (filePath) => [CONFIG_MATRIX_REL_PATH, PART_SUFFIX].some((pattern) => filePath.toLowerCase().indexOf(pattern) !== -1);
	const predicate = (instr) => !!gameId ? GAME_ID === gameId && hasMenuModPattern(instr) : instr.type === "copy" && hasMenuModPattern(instr.source);
	return !!gameId ? Promise.resolve({
		supported: instructions.find(predicate) !== void 0,
		requiredFiles: []
	}) : Promise.resolve(instructions.find(predicate) !== void 0);
}
function installMenuMod(files, destinationPath) {
	const filtered = files.filter((file) => path.default.extname(path.default.basename(file)) !== "");
	const inputFiles = filtered.filter((file) => file.indexOf(CONFIG_MATRIX_REL_PATH) !== -1);
	const uniqueInput = inputFiles.reduce((accum, iter) => {
		const fileName = path.default.basename(iter);
		if (accum.find((entry) => path.default.basename(entry) === fileName) !== void 0) return accum;
		if (inputFiles.filter((file) => path.default.basename(file) === fileName).length > 1) {
			if (iter.toLowerCase().indexOf("backup") === -1) accum.push(iter);
		} else accum.push(iter);
		return accum;
	}, []);
	let otherFiles = filtered.filter((file) => !inputFiles.includes(file));
	const inputFileDestination = CONFIG_MATRIX_REL_PATH;
	const binIdx = uniqueInput?.[0]?.toLowerCase()?.split(path.default.sep)?.indexOf?.("bin");
	const modFiles = otherFiles.filter((file) => file.toLowerCase().split(path.default.sep).includes("mods"));
	const modsIdx = modFiles.length > 0 ? modFiles[0].toLowerCase().split(path.default.sep).indexOf("mods") : -1;
	const modNames = modsIdx !== -1 ? modFiles.reduce((accum, iter) => {
		const modName = iter.split(path.default.sep).splice(modsIdx + 1, 1).join();
		if (!accum.includes(modName)) accum.push(modName);
		return accum;
	}, []) : [];
	if (modFiles.length > 0) otherFiles = otherFiles.filter((file) => !modFiles.includes(file));
	const modName = binIdx > 0 ? inputFiles[0].split(path.default.sep)[binIdx - 1] : ("mod" + path.default.basename(destinationPath, ".installing")).replace(/\s/g, "");
	const trimmedFiles = otherFiles.map((file) => {
		const source = file;
		let relPath = file.split(path.default.sep).slice(binIdx);
		if (relPath[0] === void 0) relPath = file.split(path.default.sep);
		const firstSeg = relPath[0].toLowerCase();
		if (firstSeg === "content" || firstSeg.endsWith(PART_SUFFIX)) relPath = [].concat(["Mods", modName], relPath);
		return {
			source,
			relPath: relPath.join(path.default.sep)
		};
	});
	const toCopyInstruction = (source, destination) => ({
		type: "copy",
		source,
		destination
	});
	const inputInstructions = uniqueInput.map((file) => toCopyInstruction(file, path.default.join(inputFileDestination, path.default.basename(file))));
	const otherInstructions = trimmedFiles.map((file) => toCopyInstruction(file.source, file.relPath));
	const modFileInstructions = modFiles.map((file) => toCopyInstruction(file, file));
	const instructions = [].concat(inputInstructions, otherInstructions, modFileInstructions);
	if (modNames.length > 0) instructions.push({
		type: "attribute",
		key: "modComponents",
		value: modNames
	});
	return Promise.resolve({ instructions });
}
function testSupportedContent(files, gameId) {
	const supported = gameId === GAME_ID && files.find((file) => file.toLowerCase().startsWith("content" + path.default.sep) !== void 0);
	return Promise.resolve({
		supported,
		requiredFiles: []
	});
}
function installContent(files, destinationPath) {
	return Promise.resolve(files.filter((file) => file.toLowerCase().startsWith("content" + path.default.sep)).map((file) => {
		const fileBase = file.split(path.default.sep).slice(1).join(path.default.sep);
		return {
			type: "copy",
			source: file,
			destination: path.default.join("mod" + destinationPath, fileBase)
		};
	}));
}
function testSupportedTL(files, gameId) {
	const supported = gameId === GAME_ID && files.find((file) => file.toLowerCase().split(path.default.sep).indexOf("mods") !== -1) !== void 0;
	return Promise.resolve({
		supported,
		requiredFiles: []
	});
}
function installTL(files) {
	let prefix = files.reduce((prev, file) => {
		const components = file.toLowerCase().split(path.default.sep);
		const idx = components.indexOf("mods");
		if (idx > 0 && (prev === void 0 || idx < prev.length)) return components.slice(0, idx) + path.default.sep;
		else return prev;
	}, "");
	const instructions = files.filter((file) => !file.endsWith(path.default.sep) && file.toLowerCase().startsWith(prefix)).map((file) => ({
		type: "copy",
		source: file,
		destination: file.slice(prefix.length)
	}));
	return Promise.resolve({ instructions });
}
function testDLCMod(files, gameId) {
	if (gameId !== GAME_ID) return Promise.resolve({
		supported: false,
		requiredFiles: []
	});
	return files.find((file) => !file.toLowerCase().startsWith("dlc")) !== void 0 ? Promise.resolve({
		supported: false,
		requiredFiles: []
	}) : Promise.resolve({
		supported: true,
		requiredFiles: []
	});
}
function installDLCMod(files) {
	const modNames = [];
	const instructions = files.reduce((accum, iter) => {
		if (path.default.extname(iter) === "") return accum;
		const segments = iter.split(path.default.sep);
		const properlyFormatted = segments.length > 2 ? segments[0].toLowerCase() === "dlc" && (segments[2] || "").toLowerCase() === "content" : false;
		const modName = properlyFormatted ? segments[1] : segments[0];
		modNames.push(modName);
		const destination = properlyFormatted ? segments.slice(1).join(path.default.sep) : segments.join(path.default.sep);
		accum.push({
			type: "copy",
			source: iter,
			destination
		});
		return accum;
	}, [{
		type: "setmodtype",
		value: "witcher3dlc"
	}]);
	const modNamesAttr = {
		type: "attribute",
		key: "modComponents",
		value: modNames
	};
	instructions.push(modNamesAttr);
	return Promise.resolve({ instructions });
}
const hasPrefix = (prefix, fileEntry) => {
	const segments = fileEntry.toLowerCase().split(path.default.sep);
	const contentIdx = segments.indexOf("content");
	if ([-1, 0].includes(contentIdx)) return false;
	return segments[contentIdx - 1].indexOf(prefix) !== -1;
};
const isRootDirectory = (fileEntry) => {
	const segments = fileEntry.toLowerCase().split(path.default.sep);
	return ["mods", "dlc"].includes(segments[0]);
};
function testSupportedMixed(files, gameId) {
	if (gameId !== GAME_ID) return Promise.resolve({
		supported: false,
		requiredFiles: []
	});
	if (files.find((file) => path.default.basename(file).toLowerCase() === CONFIG_MATRIX_REL_PATH) !== void 0) return Promise.resolve({
		supported: false,
		requiredFiles: []
	});
	const supported = files.some((file) => hasPrefix("dlc", file)) && files.some((file) => hasPrefix("mod", file));
	return Promise.resolve({
		supported,
		requiredFiles: []
	});
}
function installMixed(files) {
	const modNames = [];
	const instructions = files.reduce((accum, iter) => {
		const isRootDir = isRootDirectory(iter);
		const segments = iter.split(path.default.sep);
		if (!path.default.extname(segments[segments.length - 1])) return accum;
		let destinationSegments = [];
		const contentIdx = segments.map((seg) => seg.toLowerCase()).indexOf("content");
		if (isRootDir) segments.shift();
		else if (contentIdx > 1) segments.splice(contentIdx - 1);
		if (hasPrefix("dlc", iter)) destinationSegments = ["dlc"].concat(segments);
		else if (hasPrefix("mod", iter)) destinationSegments = ["mods"].concat(segments);
		else destinationSegments = iter.split(path.default.sep);
		modNames.push(segments[0]);
		const instruction = {
			type: "copy",
			source: iter,
			destination: destinationSegments.join(path.default.sep)
		};
		accum.push(instruction);
		return accum;
	}, []).concat([{
		type: "attribute",
		key: "modComponents",
		value: Array.from(new Set(modNames))
	}, {
		type: "setmodtype",
		value: "witcher3menumodroot"
	}]);
	return Promise.resolve({ instructions });
}

//#endregion
//#region extensions/games/game-witcher3/actions.ts
const setPriorityType = (0, redux_act.createAction)("TW3_SET_PRIORITY_TYPE", (type) => type);
const setSuppressModLimitPatch = (0, redux_act.createAction)("TW3_SET_SUPPRESS_LIMIT_PATCH", (suppress) => suppress);

//#endregion
//#region extensions/games/game-witcher3/reducers.ts
const W3Reducer = {
	reducers: {
		[setPriorityType]: (state, payload) => {
			return vortex_api.util.setSafe(state, ["prioritytype"], payload);
		},
		[setSuppressModLimitPatch]: (state, payload) => {
			return vortex_api.util.setSafe(state, ["suppressModLimitPatch"], payload);
		}
	},
	defaults: {
		prioritytype: "prefix-based",
		suppressModLimitPatch: false
	}
};

//#endregion
//#region extensions/games/game-witcher3/eventHandlers.ts
init_common();
function onGameModeActivation(api) {
	return async (gameMode) => {
		if (gameMode !== GAME_ID) api.dismissNotification("witcher3-merge");
		else {
			const state = api.getState();
			const lastProfId = vortex_api.selectors.lastActiveProfileForGame(state, gameMode);
			const activeProf = vortex_api.selectors.activeProfile(state);
			const priorityType = vortex_api.util.getSafe(state, getPriorityTypeBranch(), "prefix-based");
			api.store.dispatch(setPriorityType(priorityType));
			if (lastProfId !== activeProf?.id) try {
				await storeToProfile(api, lastProfId).then(() => restoreFromProfile(api, activeProf?.id));
			} catch (err) {
				api.showErrorNotification("Failed to restore profile merged files", err);
			}
		}
	};
}
const onWillDeploy = (api) => {
	return async (profileId, deployment) => {
		const activeProfile = validateProfile(profileId, api.store.getState());
		if (activeProfile === void 0 || suppressEventHandlers(api)) return Promise.resolve();
		return onWillDeploy$1(api, deployment, activeProfile).catch((err) => err instanceof vortex_api.util.UserCanceled ? Promise.resolve() : Promise.reject(err));
	};
};
const applyToIniStruct = (api, getPriorityManager, modIds) => {
	const newLO = [...getPersistentLoadOrder(api).filter((entry) => !modIds.includes(entry.modId))];
	IniStructure.getInstance(api, getPriorityManager).setINIStruct(newLO).then(() => forceRefresh(api));
};
const onModsDisabled = (api, priorityManager) => {
	return async (modIds, enabled, gameId) => {
		if (gameId !== GAME_ID || enabled) return;
		applyToIniStruct(api, priorityManager, modIds);
	};
};
const onDidRemoveMod = (api, priorityManager) => {
	return async (gameId, modId, removeOpts) => {
		if (GAME_ID !== gameId || removeOpts?.willBeReplaced) return Promise.resolve();
		applyToIniStruct(api, priorityManager, [modId]);
	};
};
const onDidPurge = (api, priorityManager) => {
	return async (profileId, deployment) => {
		if (validateProfile(profileId, api.getState()) === void 0) return Promise.resolve();
		return IniStructure.getInstance(api, priorityManager).revertLOFile();
	};
};
let prevDeployment = {};
const onDidDeploy = (api) => {
	return async (profileId, deployment) => {
		const activeProfile = validateProfile(profileId, api.getState());
		if (activeProfile === void 0) return Promise.resolve();
		if (JSON.stringify(prevDeployment) !== JSON.stringify(deployment)) {
			prevDeployment = deployment;
			queryScriptMerge(api, "Your mods state/load order has changed since the last time you ran the script merger. You may want to run the merger tool and check whether any new script conflicts are present, or if existing merges have become unecessary. Please also note that any load order changes may affect the order in which your conflicting mods are meant to be merged, and may require you to remove the existing merge and re-apply it.");
		}
		const loadOrder = getPersistentLoadOrder(api);
		const docFiles = (deployment["witcher3menumodroot"] ?? []).filter((file) => file.relPath.endsWith(PART_SUFFIX) && file.relPath.indexOf(INPUT_XML_FILENAME) === -1);
		const menuModPromise = () => {
			if (docFiles.length === 0) return removeMenuMod(api, activeProfile);
			else return onDidDeploy$1(api, deployment, activeProfile).then(async (modId) => {
				if (modId === void 0) return Promise.resolve();
				api.store.dispatch(vortex_api.actions.setModEnabled(activeProfile.id, modId, true));
				await api.emitAndAwait("deploy-single-mod", GAME_ID, modId, true);
				return Promise.resolve();
			});
		};
		return menuModPromise().then(() => IniStructure.getInstance().setINIStruct(loadOrder)).then(() => {
			forceRefresh(api);
			return Promise.resolve();
		}).catch((err) => IniStructure.getInstance().modSettingsErrorHandler(err, "Failed to modify load order file"));
	};
};
const onProfileWillChange = (api) => {
	return async (profileId) => {
		const state = api.getState();
		const profile = vortex_api.selectors.profileById(state, profileId);
		if (profile?.gameId !== GAME_ID) return;
		const priorityType = vortex_api.util.getSafe(state, getPriorityTypeBranch(), "prefix-based");
		api.store.dispatch(setPriorityType(priorityType));
		const lastProfId = vortex_api.selectors.lastActiveProfileForGame(state, profile.gameId);
		try {
			await storeToProfile(api, lastProfId).then(() => restoreFromProfile(api, profile.id));
		} catch (err) {
			if (!(err instanceof vortex_api.util.UserCanceled)) api.showErrorNotification("Failed to store profile specific merged items", err);
		}
	};
};
const onSettingsChange = (api, priorityManager) => {
	return (prev, current) => {
		const state = api.getState();
		if (vortex_api.selectors.activeProfile(state)?.gameId !== GAME_ID || priorityManager === void 0) return;
		const priorityType = vortex_api.util.getSafe(state, getPriorityTypeBranch(), "prefix-based");
		priorityManager().priorityType = priorityType;
	};
};
function getScriptMergerTool(api) {
	const state = api.store.getState();
	const scriptMerger = vortex_api.util.getSafe(state, [
		"settings",
		"gameMode",
		"discovered",
		GAME_ID,
		"tools",
		SCRIPT_MERGER_ID$1
	], void 0);
	if (!!scriptMerger?.path) return scriptMerger;
}
function runScriptMerger(api) {
	const tool = getScriptMergerTool(api);
	if (tool?.path === void 0) {
		notifyMissingScriptMerger(api);
		return Promise.resolve();
	}
	return api.runExecutable(tool.path, [], { suggestDeploy: true }).catch((err) => api.showErrorNotification("Failed to run tool", err, { allowReport: [
		"EPERM",
		"EACCESS",
		"ENOENT"
	].indexOf(err.code) !== -1 }));
}
function queryScriptMerge(api, reason) {
	const state = api.store.getState();
	const t = api.translate;
	if ((state.session.base.activity?.installing_dependencies ?? []).length > 0) return;
	if (!!vortex_api.util.getSafe(state, [
		"settings",
		"gameMode",
		"discovered",
		GAME_ID,
		"tools",
		SCRIPT_MERGER_ID$1
	], void 0)?.path) api.sendNotification({
		id: "witcher3-merge",
		type: "warning",
		message: t("Witcher Script merger may need to be executed", { ns: I18N_NAMESPACE }),
		allowSuppress: true,
		actions: [{
			title: "More",
			action: () => {
				api.showDialog("info", "Witcher 3", { text: reason }, [{ label: "Close" }]);
			}
		}, {
			title: "Run tool",
			action: (dismiss) => {
				runScriptMerger(api);
				dismiss();
			}
		}]
	});
	else notifyMissingScriptMerger(api);
}

//#endregion
//#region extensions/games/game-witcher3/index.ts
init_common();
const GOG_ID = "1207664663";
const GOG_ID_GOTY = "1495134320";
const GOG_WH_ID = "1207664643";
const GOG_WH_GOTY = "1640424747";
const STEAM_ID = "499450";
const STEAM_ID_WH = "292030";
const EPIC_ID = "725a22e15ed74735bb0d6a19f3cc82d0";
const tools = [
	{
		id: SCRIPT_MERGER_ID$1,
		name: "W3 Script Merger",
		logo: "WitcherScriptMerger.jpg",
		executable: () => "WitcherScriptMerger.exe",
		requiredFiles: ["WitcherScriptMerger.exe"]
	},
	{
		id: GAME_ID + "_DX11",
		name: "The Witcher 3 (DX11)",
		logo: "auto",
		relative: true,
		executable: () => "bin/x64/witcher3.exe",
		requiredFiles: ["bin/x64/witcher3.exe"]
	},
	{
		id: GAME_ID + "_DX12",
		name: "The Witcher 3 (DX12)",
		logo: "auto",
		relative: true,
		executable: () => "bin/x64_DX12/witcher3.exe",
		requiredFiles: ["bin/x64_DX12/witcher3.exe"]
	}
];
function findGame() {
	try {
		const instPath = winapi_bindings.default.RegGetValue("HKEY_LOCAL_MACHINE", "Software\\CD Project Red\\The Witcher 3", "InstallFolder");
		if (!instPath) throw new Error("empty registry key");
		return bluebird.default.resolve(instPath.value);
	} catch (err) {
		return vortex_api.util.GameStoreHelper.findByAppId([
			GOG_ID_GOTY,
			GOG_ID,
			GOG_WH_ID,
			GOG_WH_GOTY,
			STEAM_ID,
			STEAM_ID_WH,
			EPIC_ID
		]).then((game) => game.gamePath);
	}
}
function prepareForModding(api) {
	return (discovery) => {
		const findScriptMerger = async (error) => {
			(0, vortex_api.log)("error", "failed to download/install script merger", error);
			const scriptMergerPath = await getScriptMergerDir(api);
			if (scriptMergerPath === void 0) {
				notifyMissingScriptMerger(api);
				return Promise.resolve();
			} else if (discovery?.tools?.W3ScriptMerger === void 0) return setMergerConfig(discovery.path, scriptMergerPath);
		};
		const ensurePath = (dirpath) => vortex_api.fs.ensureDirWritableAsync(dirpath).catch((err) => err.code === "EEXIST" ? Promise.resolve() : Promise.reject(err));
		return Promise.all([
			ensurePath(path.default.join(discovery.path, "Mods")),
			ensurePath(path.default.join(discovery.path, "DLC")),
			ensurePath(path.default.dirname(getLoadOrderFilePath()))
		]).then(() => downloadScriptMerger(api).catch((err) => err instanceof vortex_api.util.UserCanceled ? Promise.resolve() : findScriptMerger(err)));
	};
}
let priorityManager;
const getPriorityManager = () => priorityManager;
function main(context) {
	context.registerReducer(["settings", "witcher3"], W3Reducer);
	context.registerGame({
		id: GAME_ID,
		name: "The Witcher 3",
		mergeMods: true,
		queryPath: findGame,
		queryModPath: () => "Mods",
		logo: "gameart.jpg",
		executable: determineExecutable,
		setup: prepareForModding(context.api),
		supportedTools: tools,
		requiresCleanup: true,
		requiredFiles: ["bin/x64/witcher3.exe"],
		environment: { SteamAPPId: "292030" },
		details: {
			steamAppId: 292030,
			ignoreConflicts: DO_NOT_DEPLOY,
			ignoreDeploy: DO_NOT_DEPLOY
		}
	});
	context.registerInstaller("scriptmergerdummy", 15, scriptMergerTest, scriptMergerDummyInstaller);
	context.registerInstaller("witcher3menumodroot", 20, testMenuModRoot, installMenuMod);
	context.registerInstaller("witcher3mixed", 25, testSupportedMixed, installMixed);
	context.registerInstaller("witcher3tl", 30, testSupportedTL, installTL);
	context.registerInstaller("witcher3content", 50, testSupportedContent, installContent);
	context.registerInstaller("witcher3dlcmod", 60, testDLCMod, installDLCMod);
	context.registerModType("witcher3menumodroot", 20, isTW3(context.api), getTLPath(context.api), testMenuModRoot);
	context.registerModType("witcher3tl", 25, isTW3(context.api), getTLPath(context.api), testTL);
	context.registerModType("witcher3dlc", 25, isTW3(context.api), getDLCPath(context.api), testDLC);
	context.registerModType("w3modlimitpatcher", 25, isTW3(context.api), getTLPath(context.api), () => bluebird.default.resolve(false), {
		deploymentEssential: false,
		name: "Mod Limit Patcher Mod Type"
	});
	context.registerModType("witcher3menumoddocuments", 60, isTW3(context.api), getDocumentsPath, () => bluebird.default.resolve(false));
	context.registerMerge(canMergeXML(context.api), doMergeXML(context.api), "witcher3menumodroot");
	context.registerMigration((oldVersion) => migrate148(context, oldVersion));
	registerActions({
		context,
		getPriorityManager
	});
	context.optional.registerCollectionFeature("witcher3_collection_data", (gameId, includedMods, collection) => genCollectionsData(context, gameId, includedMods, collection), (gameId, collection) => parseCollectionsData(context, gameId, collection), () => Promise.resolve(), (t) => t("Witcher 3 Data"), (state, gameId) => gameId === GAME_ID, CollectionsDataView_default);
	context.registerProfileFeature("local_merges", "boolean", "settings", "Profile Data", "This profile will store and restore profile specific data (merged scripts, loadorder, etc) when switching profiles", () => {
		return vortex_api.selectors.activeGameId(context.api.getState()) === GAME_ID;
	});
	const toggleModsState = async (enabled) => {
		const state = context.api.store.getState();
		const profile = vortex_api.selectors.activeProfile(state);
		const loadOrder = getPersistentLoadOrder(context.api);
		const modMap = await getAllMods(context.api);
		const manualLocked = modMap.manual.filter((modName) => modName.startsWith(LOCKED_PREFIX));
		const totalLocked = [].concat(modMap.merged, manualLocked);
		const newLO = loadOrder.reduce((accum, key, idx) => {
			if (totalLocked.includes(key)) accum.push(loadOrder[idx]);
			else accum.push({
				...loadOrder[idx],
				enabled
			});
			return accum;
		}, []);
		context.api.store.dispatch(vortex_api.actions.setLoadOrder(profile.id, newLO));
	};
	const props = {
		onToggleModsState: toggleModsState,
		api: context.api,
		getPriorityManager
	};
	context.registerLoadOrder(new TW3LoadOrder(props));
	context.once(() => {
		priorityManager = new PriorityManager(context.api, "prefix-based");
		IniStructure.getInstance(context.api, getPriorityManager);
		context.api.events.on("gamemode-activated", onGameModeActivation(context.api));
		context.api.events.on("profile-will-change", onProfileWillChange(context.api));
		context.api.events.on("mods-enabled", onModsDisabled(context.api, getPriorityManager));
		context.api.onAsync("will-deploy", onWillDeploy(context.api));
		context.api.onAsync("did-deploy", onDidDeploy(context.api));
		context.api.onAsync("did-purge", onDidPurge(context.api, getPriorityManager));
		context.api.onAsync("did-remove-mod", onDidRemoveMod(context.api, getPriorityManager));
		context.api.onStateChange(["settings", "witcher3"], onSettingsChange(context.api, getPriorityManager));
	});
	return true;
}
module.exports = { default: main };

//#endregion
//# sourceMappingURL=index.js.map