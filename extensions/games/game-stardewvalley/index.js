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
let react = require("react");
react = __toESM(react);
let semver = require("semver");
semver = __toESM(semver);
let turbowalk = require("turbowalk");
turbowalk = __toESM(turbowalk);
let vortex_api = require("vortex-api");
let winapi_bindings = require("winapi-bindings");
winapi_bindings = __toESM(winapi_bindings);
let relaxed_json = require("relaxed-json");
let path = require("path");
path = __toESM(path);
let redux_act = require("redux-act");
let https = require("https");
https = __toESM(https);
let react_bootstrap = require("react-bootstrap");
let react_i18next = require("react-i18next");
let react_redux = require("react-redux");

//#region extensions/games/game-stardewvalley/CompatibilityIcon.tsx
const iconMap = {
	broken: "feedback-error",
	obsolete: "feedback-error",
	abandoned: "feedback-warning",
	unofficial: "feedback-warning",
	workaround: "feedback-warning",
	unknown: "feedback-info",
	optional: "feedback-success",
	ok: "feedback-success"
};
function CompatibilityIcon(props) {
	const { t, mod } = props;
	const version = mod.attributes?.manifestVersion ?? mod.attributes?.version;
	if (mod.attributes?.compatibilityUpdate !== void 0 && mod.attributes?.compatibilityUpdate !== version) return /* @__PURE__ */ react.default.createElement(vortex_api.tooltip.Icon, {
		name: "auto-update",
		tooltip: t("SMAPI suggests updating this mod to {{update}}. Please use Vortex to check for mod updates", { replace: { update: mod.attributes?.compatibilityUpdate } })
	});
	const status = (mod.attributes?.compatibilityStatus ?? "unknown").toLowerCase();
	const icon = iconMap[status] ?? iconMap["unknown"];
	return /* @__PURE__ */ react.default.createElement(vortex_api.tooltip.Icon, {
		name: icon,
		className: `sdv-compatibility-${status}`,
		tooltip: mod.attributes?.compatibilityMessage ?? t("No information")
	});
}

//#endregion
//#region extensions/games/game-stardewvalley/constants.ts
var SMAPI_QUERY_FREQUENCY, SMAPI_IO_API_VERSION, SMAPI_MOD_ID, SMAPI_URL;
var init_constants = __esmMin((() => {
	SMAPI_QUERY_FREQUENCY = 1e3 * 60 * 24 * 7;
	SMAPI_IO_API_VERSION = "3.0.0";
	SMAPI_MOD_ID = 2400;
	SMAPI_URL = `https://www.nexusmods.com/stardewvalley/mods/${SMAPI_MOD_ID}`;
}));

//#endregion
//#region extensions/games/game-stardewvalley/common.ts
var common_exports = /* @__PURE__ */ __exportAll({
	GAME_ID: () => GAME_ID$1,
	MOD_CONFIG: () => MOD_CONFIG,
	MOD_MANIFEST: () => MOD_MANIFEST,
	MOD_TYPE_CONFIG: () => MOD_TYPE_CONFIG$1,
	NOTIF_ACTIVITY_CONFIG_MOD: () => NOTIF_ACTIVITY_CONFIG_MOD,
	RGX_INVALID_CHARS_WINDOWS: () => RGX_INVALID_CHARS_WINDOWS,
	SMAPI_INTERNAL_DIRECTORY: () => SMAPI_INTERNAL_DIRECTORY,
	_SMAPI_BUNDLED_MODS: () => _SMAPI_BUNDLED_MODS$1,
	getBundledMods: () => getBundledMods$1
});
var GAME_ID$1, MOD_CONFIG, MOD_MANIFEST, RGX_INVALID_CHARS_WINDOWS, MOD_TYPE_CONFIG$1, SMAPI_INTERNAL_DIRECTORY, _SMAPI_BUNDLED_MODS$1, NOTIF_ACTIVITY_CONFIG_MOD, getBundledMods$1;
var init_common = __esmMin((() => {
	GAME_ID$1 = "stardewvalley";
	MOD_CONFIG = "config.json";
	MOD_MANIFEST = "manifest.json";
	RGX_INVALID_CHARS_WINDOWS = /[:/\\*?"<>|]/g;
	MOD_TYPE_CONFIG$1 = "sdv-configuration-mod";
	SMAPI_INTERNAL_DIRECTORY = "smapi-internal";
	_SMAPI_BUNDLED_MODS$1 = [
		"ErrorHandler",
		"ConsoleCommands",
		"SaveBackup"
	];
	NOTIF_ACTIVITY_CONFIG_MOD = "sdv-config-mod-activity";
	getBundledMods$1 = () => {
		return Array.from(new Set(_SMAPI_BUNDLED_MODS$1.map((modName) => modName.toLowerCase())));
	};
}));

//#endregion
//#region extensions/games/game-stardewvalley/util.ts
init_common();
init_constants();
function defaultModsRelPath() {
	return "Mods";
}
async function parseManifest(manifestFilePath) {
	try {
		const manifestData = await vortex_api.fs.readFileAsync(manifestFilePath, { encoding: "utf-8" });
		const manifest = (0, relaxed_json.parse)(vortex_api.util.deBOM(manifestData));
		if (!manifest) throw new vortex_api.util.DataInvalid("Manifest file is invalid");
		return manifest;
	} catch (err) {
		return Promise.reject(err);
	}
}
/**
* semver.coerce drops pre-release information from a
* perfectly valid semantic version string, don't want that
*/
function coerce$1(input) {
	try {
		return new semver.SemVer(input);
	} catch (err) {
		return semver.coerce(input);
	}
}
function semverCompare(lhs, rhs) {
	const l = coerce$1(lhs);
	const r = coerce$1(rhs);
	if (l !== null && r !== null) return semver.compare(l, r);
	else return lhs.localeCompare(rhs, "en-US");
}
async function walkPath(dirPath, walkOptions) {
	walkOptions = !!walkOptions ? {
		...walkOptions,
		skipHidden: true,
		skipInaccessible: true,
		skipLinks: true
	} : {
		skipLinks: true,
		skipHidden: true,
		skipInaccessible: true
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
async function deleteFolder(dirPath, walkOptions) {
	try {
		const entries = await walkPath(dirPath, walkOptions);
		entries.sort((a, b) => b.filePath.length - a.filePath.length);
		for (const entry of entries) await vortex_api.fs.removeAsync(entry.filePath);
		await vortex_api.fs.rmdirAsync(dirPath);
	} catch (err) {
		return Promise.reject(err);
	}
}

//#endregion
//#region extensions/games/game-stardewvalley/DependencyManager.ts
var DependencyManager = class {
	constructor(api) {
		this.mLoading = false;
		this.mApi = api;
	}
	async getManifests() {
		await this.scanManifests();
		return this.mManifests;
	}
	async refresh() {
		if (this.mLoading) return;
		this.mLoading = true;
		await this.scanManifests(true);
		this.mLoading = false;
	}
	async scanManifests(force) {
		if (!force && this.mManifests !== void 0) return;
		const state = this.mApi.getState();
		const staging = vortex_api.selectors.installPathForGame(state, GAME_ID$1);
		const profileId = vortex_api.selectors.lastActiveProfileForGame(state, GAME_ID$1);
		const profile = vortex_api.selectors.profileById(state, profileId);
		const isInstalled = (mod) => mod?.state === "installed";
		const isActive = (modId) => vortex_api.util.getSafe(profile, [
			"modState",
			modId,
			"enabled"
		], false);
		const mods = vortex_api.util.getSafe(state, [
			"persistent",
			"mods",
			GAME_ID$1
		], {});
		this.mManifests = await Object.values(mods).reduce(async (accumP, iter) => {
			const accum = await accumP;
			if (!isInstalled(iter) || !isActive(iter.id)) return Promise.resolve(accum);
			return (0, turbowalk.default)(path.default.join(staging, iter.installationPath), async (entries) => {
				for (const entry of entries) if (path.default.basename(entry.filePath) === "manifest.json") {
					let manifest;
					try {
						manifest = await parseManifest(entry.filePath);
					} catch (err) {
						(0, vortex_api.log)("error", "failed to parse manifest", {
							error: err.message,
							manifest: entry.filePath
						});
						continue;
					}
					const list = accum[iter.id] ?? [];
					list.push(manifest);
					accum[iter.id] = list;
				}
			}, {
				skipHidden: false,
				recurse: true,
				skipInaccessible: true,
				skipLinks: true
			}).then(() => Promise.resolve(accum)).catch((err) => {
				if (err["code"] === "ENOENT") return Promise.resolve([]);
				else return Promise.reject(err);
			});
		}, {});
		return Promise.resolve();
	}
};

//#endregion
//#region extensions/games/game-stardewvalley/actions.ts
const setRecommendations = (0, redux_act.createAction)("SET_SDV_RECOMMENDATIONS", (enabled) => enabled);
const setMergeConfigs = (0, redux_act.createAction)("SET_SDV_MERGE_CONFIGS", (profileId, enabled) => ({
	profileId,
	enabled
}));

//#endregion
//#region extensions/games/game-stardewvalley/reducers.ts
const sdvReducers = {
	reducers: {
		[setRecommendations]: (state, payload) => {
			return vortex_api.util.setSafe(state, ["useRecommendations"], payload);
		},
		[setMergeConfigs]: (state, payload) => {
			const { profileId, enabled } = payload;
			return vortex_api.util.setSafe(state, ["mergeConfigs", profileId], enabled);
		}
	},
	defaults: { useRecommendations: void 0 }
};

//#endregion
//#region extensions/games/game-stardewvalley/smapiProxy.ts
init_common();
const SMAPI_HOST = "smapi.io";
var SMAPIProxy = class {
	constructor(api) {
		this.mAPI = api;
		this.mOptions = {
			host: SMAPI_HOST,
			method: "POST",
			protocol: "https:",
			path: "/api/v3.0/mods",
			headers: { "Content-Type": "application/json" }
		};
	}
	async find(query) {
		if (query.name !== void 0) {
			const res = await this.findByNames([{ id: query.name }]);
			if (res.length === 0 || res[0].metadata?.main === void 0) return [];
			const key = this.makeKey(query);
			if (res[0].metadata.nexusID !== void 0) return await this.lookupOnNexus(query, res[0].metadata.nexusID, res[0].metadata.main.version);
			else return [{
				key,
				value: {
					gameId: GAME_ID$1,
					fileMD5: void 0,
					fileName: query.name,
					fileSizeBytes: 0,
					fileVersion: "",
					sourceURI: res[0].metadata.main?.url
				}
			}];
		} else return [];
	}
	async findByNames(query) {
		return new Promise((resolve, reject) => {
			const req = https.request(this.mOptions, (res) => {
				let body = Buffer.from([]);
				res.on("error", (err) => reject(err)).on("data", (chunk) => {
					body = Buffer.concat([body, chunk]);
				}).on("end", () => {
					const textual = body.toString("utf8");
					try {
						resolve(JSON.parse(textual));
					} catch (err) {
						(0, vortex_api.log)("error", "failed to parse smapi response", textual);
						reject(err);
					}
				});
			}).on("error", (err) => reject(err));
			req.write(JSON.stringify({
				mods: query,
				includeExtendedMetadata: true,
				apiVersion: SMAPI_IO_API_VERSION
			}));
			req.end();
		});
	}
	makeKey(query) {
		return `smapio:${query.name}:${query.versionMatch}`;
	}
	async lookupOnNexus(query, nexusId, version) {
		await this.mAPI.ext.ensureLoggedIn();
		const files = await this.mAPI.ext.nexusGetModFiles?.(GAME_ID$1, nexusId) ?? [];
		const versionPattern = `>=${version}`;
		const file = files.filter((iter) => semver.satisfies(coerce$1(iter.version), versionPattern)).sort((lhs, rhs) => semverCompare(rhs.version, lhs.version))[0];
		if (file === void 0) throw new Error("no file found");
		return [{
			key: this.makeKey(query),
			value: {
				fileMD5: void 0,
				fileName: file.file_name,
				fileSizeBytes: file.size * 1024,
				fileVersion: file.version,
				gameId: GAME_ID$1,
				sourceURI: `nxm://${GAME_ID$1}/mods/${nexusId}/files/${file.file_id}`,
				logicalFileName: query.name.toLowerCase(),
				source: "nexus",
				domainName: GAME_ID$1,
				details: {
					category: file.category_id.toString(),
					description: file.description,
					modId: nexusId.toString(),
					fileId: file.file_id.toString()
				}
			}
		}];
	}
};

//#endregion
//#region extensions/games/game-stardewvalley/SMAPI.ts
var SMAPI_exports = /* @__PURE__ */ __exportAll({
	deploySMAPI: () => deploySMAPI$1,
	downloadSMAPI: () => downloadSMAPI$1,
	findSMAPIMod: () => findSMAPIMod$1,
	findSMAPITool: () => findSMAPITool,
	getSMAPIMods: () => getSMAPIMods
});
function findSMAPITool(api) {
	const state = api.getState();
	const tool = vortex_api.selectors.discoveryByGame(state, GAME_ID$1)?.tools?.["smapi"];
	return !!tool?.path ? tool : void 0;
}
function getSMAPIMods(api) {
	const state = api.getState();
	const profileId = vortex_api.selectors.lastActiveProfileForGame(state, GAME_ID$1);
	const profile = vortex_api.selectors.profileById(state, profileId);
	const isActive = (modId) => vortex_api.util.getSafe(profile, [
		"modState",
		modId,
		"enabled"
	], false);
	const isSMAPI = (mod) => mod.type === "SMAPI" && mod.attributes?.modId === SMAPI_MOD_ID;
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID$1
	], {});
	return Object.values(mods).filter((mod) => isSMAPI(mod) && isActive(mod.id));
}
function findSMAPIMod$1(api) {
	const SMAPIMods = getSMAPIMods(api);
	return SMAPIMods.length === 0 ? void 0 : SMAPIMods.length > 1 ? SMAPIMods.reduce((prev, iter) => {
		if (prev === void 0) return iter;
		return (0, semver.gte)(iter?.attributes?.version ?? "0.0.0", prev?.attributes?.version ?? "0.0.0") ? iter : prev;
	}, void 0) : SMAPIMods[0];
}
async function deploySMAPI$1(api) {
	await vortex_api.util.toPromise((cb) => api.events.emit("deploy-mods", cb));
	await vortex_api.util.toPromise((cb) => api.events.emit("start-quick-discovery", () => cb(null)));
	const tool = vortex_api.selectors.discoveryByGame(api.getState(), GAME_ID$1)?.tools?.["smapi"];
	if (tool) api.store.dispatch(vortex_api.actions.setPrimaryTool(GAME_ID$1, tool.id));
}
async function downloadSMAPI$1(api, update) {
	api.dismissNotification("smapi-missing");
	api.sendNotification({
		id: "smapi-installing",
		message: update ? "Updating SMAPI" : "Installing SMAPI",
		type: "activity",
		noDismiss: true,
		allowSuppress: false
	});
	if (api.ext?.ensureLoggedIn !== void 0) await api.ext.ensureLoggedIn();
	try {
		const modFiles = await api.ext.nexusGetModFiles(GAME_ID$1, SMAPI_MOD_ID);
		const fileTime = (input) => Number.parseInt(input.uploaded_time, 10);
		const file = modFiles.filter((file) => file.category_id === 1).sort((lhs, rhs) => fileTime(lhs) - fileTime(rhs))[0];
		if (file === void 0) throw new vortex_api.util.ProcessCanceled("No SMAPI main file found");
		const dlInfo = {
			game: GAME_ID$1,
			name: "SMAPI"
		};
		const nxmUrl = `nxm://${GAME_ID$1}/mods/${SMAPI_MOD_ID}/files/${file.file_id}`;
		const dlId = await vortex_api.util.toPromise((cb) => api.events.emit("start-download", [nxmUrl], dlInfo, void 0, cb, void 0, { allowInstall: false }));
		const modId = await vortex_api.util.toPromise((cb) => api.events.emit("start-install-download", dlId, { allowAutoEnable: false }, cb));
		const profileId = vortex_api.selectors.lastActiveProfileForGame(api.getState(), GAME_ID$1);
		await vortex_api.actions.setModsEnabled(api, profileId, [modId], true, {
			allowAutoDeploy: false,
			installed: true
		});
		await deploySMAPI$1(api);
	} catch (err) {
		api.showErrorNotification("Failed to download/install SMAPI", err);
		vortex_api.util.opn(SMAPI_URL).catch(() => null);
	} finally {
		api.dismissNotification("smapi-installing");
	}
}
var init_SMAPI = __esmMin((() => {
	init_common();
	init_constants();
}));

//#endregion
//#region extensions/games/game-stardewvalley/tests.ts
init_SMAPI();
init_common();
async function testSMAPIOutdated(api, depManager) {
	const state = api.getState();
	if (vortex_api.selectors.activeGameId(state) !== GAME_ID$1) return Promise.resolve(void 0);
	let currentSMAPIVersion = findSMAPIMod$1(api)?.attributes?.version;
	if (currentSMAPIVersion === void 0) return Promise.resolve(void 0);
	const isSmapiOutdated = async () => {
		currentSMAPIVersion = findSMAPIMod$1(api)?.attributes?.version;
		const enabledManifests = await depManager.getManifests();
		const incompatibleModIds = [];
		for (const [id, manifests] of Object.entries(enabledManifests)) if (manifests.filter((iter) => {
			if (iter.MinimumApiVersion !== void 0) return !(0, semver.gte)(currentSMAPIVersion, (0, semver.coerce)(iter.MinimumApiVersion ?? "0.0.0"));
			return false;
		}).length > 0) incompatibleModIds.push(id);
		return Promise.resolve(incompatibleModIds.length > 0);
	};
	const outdated = await isSmapiOutdated();
	const t = api.translate;
	return outdated ? Promise.resolve({
		description: {
			short: t("SMAPI update required"),
			long: t("Some Stardew Valley mods require a newer version of SMAPI to function correctly, you should check for SMAPI updates in the mods page.")
		},
		automaticFix: () => downloadSMAPI$1(api, true),
		onRecheck: () => isSmapiOutdated(),
		severity: "warning"
	}) : Promise.resolve(void 0);
}

//#endregion
//#region extensions/games/game-stardewvalley/types.ts
const compatibilityOptions = [
	"broken",
	"obsolete",
	"abandoned",
	"unofficial",
	"workaround",
	"unknown",
	"optional",
	"ok"
];

//#endregion
//#region extensions/games/game-stardewvalley/Settings.tsx
init_common();
function Settings(props) {
	const { onMergeConfigToggle } = props;
	const { useRecommendations, mergeConfigs } = (0, react_redux.useSelector)((state) => state.settings["SDV"]);
	const store = (0, react_redux.useStore)();
	const { profileId } = (0, react_redux.useSelector)(mapStateToProps);
	const setUseRecommendations = react.default.useCallback((enabled) => {
		store.dispatch(setRecommendations(enabled));
	}, []);
	const setMergeConfigSetting = react.default.useCallback((enabled) => {
		onMergeConfigToggle(profileId, enabled);
	}, [onMergeConfigToggle, profileId]);
	const { t } = (0, react_i18next.useTranslation)();
	const mergeEnabled = mergeConfigs?.[profileId];
	return /* @__PURE__ */ react.default.createElement("form", null, /* @__PURE__ */ react.default.createElement(react_bootstrap.FormGroup, { controlId: "default-enable" }, /* @__PURE__ */ react.default.createElement(react_bootstrap.Panel, null, /* @__PURE__ */ react.default.createElement(react_bootstrap.Panel.Body, null, /* @__PURE__ */ react.default.createElement(react_bootstrap.ControlLabel, null, t("Stardew Valley")), /* @__PURE__ */ react.default.createElement(vortex_api.Toggle, {
		checked: useRecommendations,
		onToggle: setUseRecommendations,
		disabled: true
	}, t("Use recommendations from the mod manifests"), /* @__PURE__ */ react.default.createElement(vortex_api.More, {
		id: "sdv_use_recommendations",
		name: "SDV Use Recommendations"
	}, t("If checked, when you install a mod for Stardew Valley you may get suggestions for installing further mods, required or recommended by it.This information could be wrong or incomplete so please carefully consider before accepting them."))), /* @__PURE__ */ react.default.createElement(vortex_api.Toggle, {
		checked: mergeEnabled,
		onToggle: setMergeConfigSetting
	}, t("Manage SDV mod configuration files"), /* @__PURE__ */ react.default.createElement(vortex_api.More, {
		id: "sdv_mod_configuration",
		name: "SDV Mod Configuration"
	}, t("Vortex by default is configured to attempt to pull-in newly created files (mod configuration json files for example) created externally (by the game itself or tools) into their respective mod folders.\n\nUnfortunately the configuration files are lost during mod updates when using this method.\n\nToggling this functionality creates a separate mod configuration \"override\" folder where all of your mod configuration files will be stored. This allows you to manage your mod configuration files on their own, regardless of mod updates. ")))))));
}
function mapStateToProps(state) {
	return { profileId: vortex_api.selectors.lastActiveProfileForGame(state, GAME_ID$1) };
}

//#endregion
//#region extensions/games/game-stardewvalley/configMod.ts
init_common();
init_SMAPI();
const syncWrapper = (api) => {
	onSyncModConfigurations(api);
};
function registerConfigMod(context) {
	context.registerAction("mod-icons", 999, "swap", {}, "Sync Mod Configurations", () => syncWrapper(context.api), () => {
		const state = context.api.store.getState();
		return vortex_api.selectors.activeGameId(state) === GAME_ID$1;
	});
}
const shouldSuppressSync = (api) => {
	const state = api.getState();
	const suppressOnActivities = ["installing_dependencies"];
	const isActivityRunning = (activity) => vortex_api.util.getSafe(state, [
		"session",
		"base",
		"activity",
		activity
	], []).length > 0;
	return suppressOnActivities.filter((activity) => isActivityRunning(activity)).length > 0;
};
async function onSyncModConfigurations(api, silent) {
	const state = api.getState();
	const profile = vortex_api.selectors.activeProfile(state);
	if (profile?.gameId !== GAME_ID$1 || shouldSuppressSync(api)) return;
	if (!findSMAPITool(api)?.path) return;
	if (!vortex_api.util.getSafe(state, [
		"settings",
		"SDV",
		"mergeConfigs",
		profile.id
	], false)) {
		if (silent) return;
		const result = await api.showDialog("info", "Mod Configuration Sync", { bbcode: "Many Stardew Valley mods generate their own configuration files during game play. By default the generated files are, ingested by their respective mods.[br][/br][br][/br]Unfortunately the mod configuration files are lost when updating or removing a mod.[br][/br][br][/br] This button allows you to Import all of your active mod's configuration files into a single mod which will remain unaffected by mod updates.[br][/br][br][/br]Would you like to enable this functionality? (SMAPI must be installed)" }, [{ label: "Close" }, { label: "Enable" }]);
		if (result.action === "Close") return;
		if (result.action === "Enable") api.store.dispatch(setMergeConfigs(profile.id, true));
	}
	const eventPromise = (api, eventType) => new Promise((resolve, reject) => {
		const cb = (err) => err !== null ? reject(err) : resolve();
		eventType === "purge-mods" ? api.events.emit(eventType, false, cb) : api.events.emit(eventType, cb);
	});
	try {
		const mod = await initialize(api);
		if (mod?.configModPath === void 0) return;
		await eventPromise(api, "purge-mods");
		const installPath = vortex_api.selectors.installPathForGame(api.getState(), GAME_ID$1);
		const resolveCandidateName = (file) => {
			return path.default.relative(installPath, file.filePath).split(path.default.sep)[0];
		};
		const files = await walkPath(installPath);
		const SMAPIModIds = getSMAPIMods(api).map((mod) => mod.id);
		const isSMAPI = (file) => file.filePath.includes(SMAPI_INTERNAL_DIRECTORY) || SMAPIModIds.forEach((modId) => file.filePath.includes(modId));
		await addModConfig(api, files.reduce((accum, file) => {
			if (isSMAPI(file)) return accum;
			if (path.default.basename(file.filePath).toLowerCase() === MOD_CONFIG && !path.default.dirname(file.filePath).includes(mod.configModPath)) {
				const candidateName = resolveCandidateName(file);
				if (vortex_api.util.getSafe(profile, [
					"modState",
					candidateName,
					"enabled"
				], false) === false) return accum;
				accum.push({
					filePath: file.filePath,
					candidates: [candidateName]
				});
			}
			return accum;
		}, []), installPath);
		await eventPromise(api, "deploy-mods");
	} catch (err) {
		api.showErrorNotification("Failed to sync mod configurations", err);
	}
}
function sanitizeProfileName(input) {
	return input.replace(RGX_INVALID_CHARS_WINDOWS, "_");
}
function configModName(profileName) {
	return `Stardew Valley Configuration (${sanitizeProfileName(profileName)})`;
}
async function initialize(api) {
	const state = api.getState();
	const profile = vortex_api.selectors.activeProfile(state);
	if (profile?.gameId !== GAME_ID$1) return Promise.resolve(void 0);
	if (!vortex_api.util.getSafe(state, [
		"settings",
		"SDV",
		"mergeConfigs",
		profile.id
	], false)) return Promise.resolve(void 0);
	try {
		const mod = await ensureConfigMod(api);
		const installationPath = vortex_api.selectors.installPathForGame(state, GAME_ID$1);
		const configModPath = path.default.join(installationPath, mod.installationPath);
		return Promise.resolve({
			configModPath,
			mod
		});
	} catch (err) {
		api.showErrorNotification("Failed to resolve config mod path", err);
		return Promise.resolve(void 0);
	}
}
async function addModConfig(api, files, modsPath) {
	const configMod = await initialize(api);
	if (configMod === void 0) return;
	const state = api.getState();
	const discovery = vortex_api.selectors.discoveryByGame(state, GAME_ID$1);
	const isInstallPath = modsPath !== void 0;
	modsPath = modsPath ?? path.default.join(discovery.path, defaultModsRelPath());
	if (findSMAPITool(api) === void 0) return;
	const configModAttributes = extractConfigModAttributes(state, configMod.mod.id);
	let newConfigAttributes = Array.from(new Set(configModAttributes));
	for (const file of files) {
		if (file.filePath.toLowerCase().split(path.default.sep).filter((seg) => !!seg).includes("smapi_internal")) continue;
		api.sendNotification({
			type: "activity",
			id: NOTIF_ACTIVITY_CONFIG_MOD,
			title: "Importing config files...",
			message: file.candidates[0]
		});
		if (!configModAttributes.includes(file.candidates[0])) newConfigAttributes.push(file.candidates[0]);
		try {
			const installRelPath = path.default.relative(modsPath, file.filePath);
			const segments = installRelPath.split(path.default.sep);
			const relPath = isInstallPath ? segments.slice(1).join(path.default.sep) : installRelPath;
			const targetPath = path.default.join(configMod.configModPath, relPath);
			const targetDir = path.default.extname(targetPath) !== "" ? path.default.dirname(targetPath) : targetPath;
			await vortex_api.fs.ensureDirWritableAsync(targetDir);
			(0, vortex_api.log)("debug", "importing config file from", {
				source: file.filePath,
				destination: targetPath,
				modId: file.candidates[0]
			});
			await vortex_api.fs.copyAsync(file.filePath, targetPath, { overwrite: true });
			await vortex_api.fs.removeAsync(file.filePath);
		} catch (err) {
			api.showErrorNotification("Failed to write mod config", err);
		}
	}
	api.dismissNotification(NOTIF_ACTIVITY_CONFIG_MOD);
	setConfigModAttribute(api, configMod.mod.id, Array.from(new Set(newConfigAttributes)));
}
async function ensureConfigMod(api) {
	const state = api.getState();
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID$1
	], {});
	const modInstalled = Object.values(mods).find((iter) => iter.type === MOD_TYPE_CONFIG$1);
	if (modInstalled !== void 0) return Promise.resolve(modInstalled);
	else {
		const profile = vortex_api.selectors.activeProfile(state);
		const mod = await createConfigMod(api, configModName(profile.name), profile);
		api.store.dispatch(vortex_api.actions.setModEnabled(profile.id, mod.id, true));
		return Promise.resolve(mod);
	}
}
async function createConfigMod(api, modName, profile) {
	const mod = {
		id: modName,
		state: "installed",
		attributes: {
			name: "Stardew Valley Mod Configuration",
			description: "This mod is a collective merge of SDV mod configuration files which Vortex maintains for the mods you have installed. The configuration is maintained through mod updates, but at times it may need to be manually updated",
			logicalFileName: "Stardew Valley Mod Configuration",
			modId: 42,
			version: "1.0.0",
			variant: sanitizeProfileName(profile.name.replace(RGX_INVALID_CHARS_WINDOWS, "_")),
			installTime: /* @__PURE__ */ new Date(),
			source: "user-generated"
		},
		installationPath: modName,
		type: MOD_TYPE_CONFIG$1
	};
	return new Promise((resolve, reject) => {
		api.events.emit("create-mod", profile.gameId, mod, async (error) => {
			if (error !== null) return reject(error);
			return resolve(mod);
		});
	});
}
async function onWillEnableMods(api, profileId, modIds, enabled, options) {
	const state = api.getState();
	if (vortex_api.selectors.profileById(state, profileId)?.gameId !== GAME_ID$1) return;
	if (enabled) {
		await onSyncModConfigurations(api, true);
		return;
	}
	const configMod = await initialize(api);
	if (!configMod) return;
	if (modIds.includes(configMod.mod.id)) {
		await onRevertFiles(api, profileId);
		return;
	}
	if (options?.installed || options?.willBeReplaced) return Promise.resolve();
	const attrib = extractConfigModAttributes(state, configMod.mod.id);
	const relevant = modIds.filter((id) => attrib.includes(id));
	if (relevant.length === 0) return;
	const installPath = vortex_api.selectors.installPathForGame(state, GAME_ID$1);
	if (enabled) {
		await onSyncModConfigurations(api);
		return;
	}
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID$1
	], {});
	for (const id of relevant) {
		const mod = mods[id];
		if (!mod?.installationPath) continue;
		const modPath = path.default.join(installPath, mod.installationPath);
		const manifestFile = (await walkPath(modPath, {
			skipLinks: true,
			skipHidden: true,
			skipInaccessible: true
		})).find((file) => path.default.basename(file.filePath) === MOD_MANIFEST);
		if (manifestFile === void 0) continue;
		const relPath = path.default.relative(modPath, path.default.dirname(manifestFile.filePath));
		const modConfigFilePath = path.default.join(configMod.configModPath, relPath, MOD_CONFIG);
		await vortex_api.fs.copyAsync(modConfigFilePath, path.default.join(modPath, relPath, MOD_CONFIG), { overwrite: true }).catch((err) => null);
		try {
			await applyToModConfig(api, () => deleteFolder(path.default.dirname(modConfigFilePath)));
		} catch (err) {
			api.showErrorNotification("Failed to write mod config", err);
			return;
		}
	}
	removeConfigModAttributes(api, configMod.mod, relevant);
}
async function applyToModConfig(api, cb) {
	try {
		const configMod = await initialize(api);
		await api.emitAndAwait("deploy-single-mod", GAME_ID$1, configMod.mod.id, false);
		await cb();
		await api.emitAndAwait("deploy-single-mod", GAME_ID$1, configMod.mod.id, true);
	} catch (err) {
		api.showErrorNotification("Failed to write mod config", err);
	}
}
async function onRevertFiles(api, profileId) {
	const state = api.getState();
	if (vortex_api.selectors.profileById(state, profileId)?.gameId !== GAME_ID$1) return;
	const configMod = await initialize(api);
	if (!configMod) return;
	const attrib = extractConfigModAttributes(state, configMod.mod.id);
	if (attrib.length === 0) return;
	await onWillEnableMods(api, profileId, attrib, false);
}
async function onAddedFiles(api, profileId, files) {
	const state = api.store.getState();
	const profile = vortex_api.selectors.profileById(state, profileId);
	if (profile?.gameId !== GAME_ID$1) return;
	if (findSMAPITool(api) === void 0) return;
	const isSMAPIFile = (file) => {
		return file.filePath.toLowerCase().split(path.default.sep).filter((seg) => !!seg).includes("smapi_internal");
	};
	const mergeConfigs = vortex_api.util.getSafe(state, [
		"settings",
		"SDV",
		"mergeConfigs",
		profile.id
	], false);
	const result = files.reduce((accum, file) => {
		if (mergeConfigs && !isSMAPIFile(file) && path.default.basename(file.filePath).toLowerCase() === MOD_CONFIG) accum.configs.push(file);
		else accum.regulars.push(file);
		return accum;
	}, {
		configs: [],
		regulars: []
	});
	return Promise.all([addConfigFiles(api, profileId, result.configs), addRegularFiles(api, profileId, result.regulars)]);
}
function extractConfigModAttributes(state, configModId) {
	return vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID$1,
		configModId,
		"attributes",
		"configMod"
	], []);
}
function setConfigModAttribute(api, configModId, attributes) {
	api.store.dispatch(vortex_api.actions.setModAttribute(GAME_ID$1, configModId, "configMod", attributes));
}
function removeConfigModAttributes(api, configMod, attributes) {
	const newAttributes = extractConfigModAttributes(api.getState(), configMod.id).filter((attr) => !attributes.includes(attr));
	setConfigModAttribute(api, configMod.id, newAttributes);
}
async function addConfigFiles(api, profileId, files) {
	if (files.length === 0) return Promise.resolve();
	api.sendNotification({
		type: "activity",
		id: NOTIF_ACTIVITY_CONFIG_MOD,
		title: "Importing config files...",
		message: "Starting up..."
	});
	return addModConfig(api, files, void 0);
}
async function addRegularFiles(api, profileId, files) {
	if (files.length === 0) return Promise.resolve();
	const state = api.getState();
	const game = vortex_api.util.getGame(GAME_ID$1);
	const discovery = vortex_api.selectors.discoveryByGame(state, GAME_ID$1);
	const modPaths = game.getModPaths(discovery.path);
	const installPath = vortex_api.selectors.installPathForGame(state, GAME_ID$1);
	for (const entry of files) if (entry.candidates.length === 1) {
		const mod = vortex_api.util.getSafe(state.persistent.mods, [GAME_ID$1, entry.candidates[0]], void 0);
		if (!isModCandidateValid(mod, entry)) return Promise.resolve();
		const from = modPaths[mod.type ?? ""];
		if (from === void 0) {
			(0, vortex_api.log)("error", "failed to resolve mod path for mod type", mod.type);
			return Promise.resolve();
		}
		const relPath = path.default.relative(from, entry.filePath);
		const targetPath = path.default.join(installPath, mod.id, relPath);
		try {
			await vortex_api.fs.ensureDirWritableAsync(path.default.dirname(targetPath));
			await vortex_api.fs.copyAsync(entry.filePath, targetPath);
			await vortex_api.fs.removeAsync(entry.filePath);
		} catch (err) {
			if (!err.message.includes("are the same file")) (0, vortex_api.log)("error", "failed to re-import added file to mod", err.message);
		}
	}
}
const isModCandidateValid = (mod, entry) => {
	if (mod?.id === void 0 || mod.type === "sdvrootfolder") return false;
	if (mod.type !== "SMAPI") return true;
	const segments = entry.filePath.toLowerCase().split(path.default.sep).filter((seg) => !!seg);
	const modsSegIdx = segments.indexOf("mods");
	const modFolderName = modsSegIdx !== -1 && segments.length > modsSegIdx + 1 ? segments[modsSegIdx + 1] : void 0;
	let bundledMods = vortex_api.util.getSafe(mod, ["attributes", "smapiBundledMods"], []);
	bundledMods = bundledMods.length > 0 ? bundledMods : getBundledMods$1();
	if (segments.includes("content")) return false;
	return modFolderName !== void 0 && bundledMods.includes(modFolderName);
};

//#endregion
//#region extensions/games/game-stardewvalley/index.ts
init_constants();
const path$1 = require("path"), { clipboard } = require("electron");
require("relaxed-json");
const { SevenZip } = vortex_api.util, { deploySMAPI, downloadSMAPI, findSMAPIMod } = (init_SMAPI(), __toCommonJS(SMAPI_exports)), { GAME_ID, _SMAPI_BUNDLED_MODS, getBundledMods, MOD_TYPE_CONFIG } = (init_common(), __toCommonJS(common_exports));
const MANIFEST_FILE = "manifest.json";
const PTRN_CONTENT = path$1.sep + "Content" + path$1.sep;
const SMAPI_EXE = "StardewModdingAPI.exe";
const SMAPI_DLL = "SMAPI.Installer.dll";
const SMAPI_DATA = ["windows-install.dat", "install.dat"];
function toBlue(func) {
	return (...args) => bluebird.default.resolve(func(...args));
}
var StardewValley = class {
	/*********
	** Vortex API
	*********/
	/**
	* Construct an instance.
	* @param {IExtensionContext} context -- The Vortex extension context.
	*/
	constructor(context) {
		this.id = GAME_ID;
		this.name = "Stardew Valley";
		this.logo = "gameart.jpg";
		this.environment = { SteamAPPId: "413150" };
		this.details = { steamAppId: 413150 };
		this.supportedTools = [{
			id: "smapi",
			name: "SMAPI",
			logo: "smapi.png",
			executable: () => SMAPI_EXE,
			requiredFiles: [SMAPI_EXE],
			shell: true,
			exclusive: true,
			relative: true,
			defaultPrimary: true
		}];
		this.mergeMods = true;
		this.requiresCleanup = true;
		this.shell = process.platform === "win32";
		this.queryPath = toBlue(async () => {
			const game = await vortex_api.util.GameStoreHelper.findByAppId([
				"413150",
				"1453375253",
				"ConcernedApe.StardewValleyPC"
			]);
			if (game) return game.gamePath;
			for (const defaultPath of this.defaultPaths) if (await this.getPathExistsAsync(defaultPath)) return defaultPath;
		});
		this.setup = toBlue(async (discovery) => {
			try {
				await vortex_api.fs.ensureDirWritableAsync(path$1.join(discovery.path, defaultModsRelPath()));
			} catch (err) {
				return Promise.reject(err);
			}
			const smapiPath = path$1.join(discovery.path, SMAPI_EXE);
			if (!await this.getPathExistsAsync(smapiPath)) this.recommendSmapi();
			this.context.api.getState();
		});
		this.context = context;
		this.requiredFiles = process.platform == "win32" ? ["Stardew Valley.exe"] : ["StardewValley"];
		this.defaultPaths = [
			process.env.HOME + "/GOG Games/Stardew Valley/game",
			process.env.HOME + "/.local/share/Steam/steamapps/common/Stardew Valley",
			"/Applications/Stardew Valley.app/Contents/MacOS",
			process.env.HOME + "/Library/Application Support/Steam/steamapps/common/Stardew Valley/Contents/MacOS",
			"C:\\Program Files (x86)\\GalaxyClient\\Games\\Stardew Valley",
			"C:\\Program Files (x86)\\GOG Galaxy\\Games\\Stardew Valley",
			"C:\\Program Files (x86)\\Steam\\steamapps\\common\\Stardew Valley"
		];
	}
	/**
	* Get the path of the tool executable relative to the tool base path, i.e. binaries/UT3.exe or
	* TESV.exe. This is a function so that you can return different things based on the operating
	* system for example but be aware that it will be evaluated at application start and only once,
	* so the return value can not depend on things that change at runtime.
	*/
	executable() {
		return process.platform == "win32" ? "Stardew Valley.exe" : "StardewValley";
	}
	/**
	* Get the default directory where mods for this game should be stored.
	* 
	* If this returns a relative path then the path is treated as relative to the game installation
	* directory. Simply return a dot ( () => '.' ) if mods are installed directly into the game
	* directory.
	*/
	queryModPath() {
		return defaultModsRelPath();
	}
	recommendSmapi() {
		const smapiMod = findSMAPIMod(this.context.api);
		const title = smapiMod ? "SMAPI is not deployed" : "SMAPI is not installed";
		const actionTitle = smapiMod ? "Deploy" : "Get SMAPI";
		const action = () => (smapiMod ? deploySMAPI(this.context.api) : downloadSMAPI(this.context.api)).then(() => this.context.api.dismissNotification("smapi-missing"));
		this.context.api.sendNotification({
			id: "smapi-missing",
			type: "warning",
			title,
			message: "SMAPI is required to mod Stardew Valley.",
			actions: [{
				title: actionTitle,
				action
			}]
		});
	}
	/*********
	** Internal methods
	*********/
	/**
	* Asynchronously check whether a file or directory path exists.
	* @param {string} path - The file or directory path.
	*/
	async getPathExistsAsync(path$4) {
		try {
			await vortex_api.fs.statAsync(path$4);
			return true;
		} catch (err) {
			return false;
		}
	}
	/**
	* Asynchronously read a registry key value.
	* @param {string} hive - The registry hive to access. This should be a constant like Registry.HKLM.
	* @param {string} key - The registry key.
	* @param {string} name - The name of the value to read.
	*/
	async readRegistryKeyAsync(hive, key, name) {
		try {
			const instPath = winapi_bindings.RegGetValue(hive, key, name);
			if (!instPath) throw new Error("empty registry key");
			return Promise.resolve(instPath.value);
		} catch (err) {
			return Promise.resolve(void 0);
		}
	}
};
function testRootFolder(files, gameId) {
	const contentDir = files.filter((file) => file.endsWith(path$1.sep)).map((file) => path$1.join("fakeDir", file)).find((file) => file.endsWith(PTRN_CONTENT));
	const supported = gameId === GAME_ID && contentDir !== void 0;
	return bluebird.default.resolve({
		supported,
		requiredFiles: []
	});
}
function installRootFolder(files, destinationPath) {
	const contentFile = files.find((file) => path$1.join("fakeDir", file).endsWith(PTRN_CONTENT));
	const idx = contentFile.indexOf(PTRN_CONTENT) + 1;
	const rootDir = path$1.basename(contentFile.substring(0, idx));
	const instructions = files.filter((file) => !file.endsWith(path$1.sep) && file.indexOf(rootDir) !== -1 && path$1.extname(file) !== ".txt").map((file) => {
		return {
			type: "copy",
			source: file,
			destination: file.substr(idx)
		};
	});
	return bluebird.default.resolve({ instructions });
}
function isValidManifest(filePath) {
	const segments = filePath.toLowerCase().split(path$1.sep);
	const isManifestFile = segments[segments.length - 1] === MANIFEST_FILE;
	const isLocale = segments.includes("locale");
	return isManifestFile && !isLocale;
}
function testSupported(files, gameId) {
	const supported = gameId === GAME_ID && files.find(isValidManifest) !== void 0 && files.find((file) => {
		return path$1.join("fakeDir", file).endsWith(PTRN_CONTENT);
	}) === void 0;
	return bluebird.default.resolve({
		supported,
		requiredFiles: []
	});
}
async function install(api, dependencyManager, files, destinationPath) {
	const manifestFiles = files.filter(isValidManifest);
	let parseError;
	await dependencyManager.scanManifests(true);
	let mods = await Promise.all(manifestFiles.map(async (manifestFile) => {
		const rootFolder = path$1.dirname(manifestFile);
		const rootSegments = rootFolder.toLowerCase().split(path$1.sep);
		const manifestIndex = manifestFile.toLowerCase().indexOf(MANIFEST_FILE);
		const filterFunc = (file) => {
			const isFile = !file.endsWith(path$1.sep) && path$1.extname(path$1.basename(file)) !== "";
			const fileSegments = file.toLowerCase().split(path$1.sep);
			return (rootSegments.length > 0 ? fileSegments?.[rootSegments.length - 1] === rootSegments[rootSegments.length - 1] : true) && isFile;
		};
		try {
			return {
				manifest: await parseManifest(path$1.join(destinationPath, manifestFile)),
				rootFolder,
				manifestIndex,
				modFiles: files.filter(filterFunc)
			};
		} catch (err) {
			(0, vortex_api.log)("warn", "Failed to parse manifest", {
				manifestFile,
				error: err.message
			});
			parseError = err;
			return;
		}
	}));
	mods = mods.filter((x) => x !== void 0);
	if (mods.length === 0) api.showErrorNotification("The mod manifest is invalid and can't be read. You can try to install the mod anyway via right-click -> \"Unpack (as-is)\"", parseError, { allowReport: false });
	return bluebird.default.map(mods, (mod) => {
		const modName = mod.rootFolder !== "." ? mod.rootFolder : mod.manifest.Name ?? mod.rootFolder;
		if (modName === void 0) return [];
		mod.manifest.Dependencies;
		const instructions = [];
		for (const file of mod.modFiles) {
			const destination = path$1.join(modName, file.substr(mod.manifestIndex));
			instructions.push({
				type: "copy",
				source: file,
				destination
			});
		}
		return instructions;
	}).then((data) => {
		const instructions = [].concat(data).reduce((accum, iter) => accum.concat(iter), []);
		return Promise.resolve({ instructions });
	});
}
function isSMAPIModType(instructions) {
	const smapiData = instructions.find((inst) => inst.type === "copy" && inst.source.endsWith(SMAPI_EXE));
	return bluebird.default.resolve(smapiData !== void 0);
}
function testSMAPI(files, gameId) {
	const supported = gameId === GAME_ID && files.find((file) => path$1.basename(file) === SMAPI_DLL) !== void 0;
	return bluebird.default.resolve({
		supported,
		requiredFiles: []
	});
}
async function installSMAPI(getDiscoveryPath, files, destinationPath) {
	const folder = process.platform === "win32" ? "windows" : process.platform === "linux" ? "linux" : "macos";
	const fileHasCorrectPlatform = (file) => {
		return file.split(path$1.sep).map((seg) => seg.toLowerCase()).includes(folder);
	};
	const dataFile = files.find((file) => {
		return fileHasCorrectPlatform(file) && SMAPI_DATA.includes(path$1.basename(file).toLowerCase());
	});
	if (dataFile === void 0) return Promise.reject(new vortex_api.util.DataInvalid("Failed to find the SMAPI data files - download appears to be corrupted; please re-download SMAPI and try again"));
	let data = "";
	try {
		data = await vortex_api.fs.readFileAsync(path$1.join(getDiscoveryPath(), "Stardew Valley.deps.json"), { encoding: "utf8" });
	} catch (err) {
		(0, vortex_api.log)("error", "failed to parse SDV dependencies", err);
	}
	const updatedFiles = [];
	await new SevenZip().extractFull(path$1.join(destinationPath, dataFile), destinationPath);
	await vortex_api.util.walk(destinationPath, (iter, stats) => {
		const relPath = path$1.relative(destinationPath, iter);
		if (!files.includes(relPath) && stats.isFile() && !files.includes(relPath + path$1.sep)) updatedFiles.push(relPath);
		const segments = relPath.toLocaleLowerCase().split(path$1.sep);
		const modsFolderIdx = segments.indexOf("mods");
		if (modsFolderIdx !== -1 && segments.length > modsFolderIdx + 1) _SMAPI_BUNDLED_MODS.push(segments[modsFolderIdx + 1]);
		return bluebird.default.resolve();
	});
	const smapiExe = updatedFiles.find((file) => file.toLowerCase().endsWith(SMAPI_EXE.toLowerCase()));
	if (smapiExe === void 0) return Promise.reject(new vortex_api.util.DataInvalid(`Failed to extract ${SMAPI_EXE} - download appears to be corrupted; please re-download SMAPI and try again`));
	const idx = smapiExe.indexOf(path$1.basename(smapiExe));
	const instructions = updatedFiles.map((file) => {
		return {
			type: "copy",
			source: file,
			destination: path$1.join(file.substr(idx))
		};
	});
	instructions.push({
		type: "attribute",
		key: "smapiBundledMods",
		value: getBundledMods()
	});
	instructions.push({
		type: "generatefile",
		data,
		destination: "StardewModdingAPI.deps.json"
	});
	return Promise.resolve({ instructions });
}
async function showSMAPILog(api, basePath, logFile) {
	const logData = await vortex_api.fs.readFileAsync(path$1.join(basePath, logFile), { encoding: "utf-8" });
	await api.showDialog("info", "SMAPI Log", { text: "Your SMAPI log is displayed below. To share it, click \"Copy & Share\" which will copy it to your clipboard and open the SMAPI log sharing website. Next, paste your code into the text box and press \"save & parse log\". You can now share a link to this page with others so they can see your log file.\n\n" + logData }, [{
		label: "Copy & Share log",
		action: () => {
			const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/^.+T([^\.]+).+/, "$1");
			clipboard.writeText(`[${timestamp} INFO Vortex] Log exported by Vortex ${vortex_api.util.getApplication().version}.\n` + logData);
			return vortex_api.util.opn("https://smapi.io/log").catch((err) => void 0);
		}
	}, {
		label: "Close",
		action: () => void 0
	}]);
}
async function onShowSMAPILog(api) {
	const basePath = path$1.join(vortex_api.util.getVortexPath("appData"), "stardewvalley", "errorlogs");
	try {
		await showSMAPILog(api, basePath, "SMAPI-crash.txt");
	} catch (err) {
		try {
			await showSMAPILog(api, basePath, "SMAPI-latest.txt");
		} catch (err) {
			api.sendNotification({
				type: "info",
				title: "No SMAPI logs found.",
				message: "",
				displayMS: 5e3
			});
		}
	}
}
function getModManifests(modPath) {
	const manifests = [];
	if (modPath === void 0) return Promise.resolve([]);
	return (0, turbowalk.default)(modPath, async (entries) => {
		for (const entry of entries) if (path$1.basename(entry.filePath) === "manifest.json") manifests.push(entry.filePath);
	}, {
		skipHidden: false,
		recurse: true,
		skipInaccessible: true,
		skipLinks: true
	}).then(() => manifests);
}
function updateConflictInfo(api, smapi, gameId, modId) {
	const mod = api.getState().persistent.mods[gameId][modId];
	if (mod === void 0) return Promise.resolve();
	const now = Date.now();
	if (now - (mod.attributes?.lastSMAPIQuery ?? 0) < SMAPI_QUERY_FREQUENCY) return Promise.resolve();
	let additionalLogicalFileNames = mod.attributes?.additionalLogicalFileNames;
	if (!additionalLogicalFileNames) if (mod.attributes?.logicalFileName) additionalLogicalFileNames = [mod.attributes?.logicalFileName];
	else additionalLogicalFileNames = [];
	const query = additionalLogicalFileNames.map((name) => {
		const res = { id: name };
		const ver = mod.attributes?.manifestVersion ?? semver.coerce(mod.attributes?.version)?.version;
		if (!!ver) res["installedVersion"] = ver;
		return res;
	});
	const stat = (item) => {
		const status = item.metadata?.compatibilityStatus?.toLowerCase?.();
		if (!compatibilityOptions.includes(status)) return "unknown";
		else return status;
	};
	const compatibilityPrio = (item) => compatibilityOptions.indexOf(stat(item));
	return smapi.findByNames(query).then((results) => {
		const worstStatus = results.sort((lhs, rhs) => compatibilityPrio(lhs) - compatibilityPrio(rhs));
		if (worstStatus.length > 0) api.store.dispatch(vortex_api.actions.setModAttributes(gameId, modId, {
			lastSMAPIQuery: now,
			compatibilityStatus: worstStatus[0].metadata.compatibilityStatus,
			compatibilityMessage: worstStatus[0].metadata.compatibilitySummary,
			compatibilityUpdate: worstStatus[0].suggestedUpdate?.version
		}));
		else {
			(0, vortex_api.log)("debug", "no manifest");
			api.store.dispatch(vortex_api.actions.setModAttribute(gameId, modId, "lastSMAPIQuery", now));
		}
	}).catch((err) => {
		(0, vortex_api.log)("warn", "error reading manifest", err.message);
		api.store.dispatch(vortex_api.actions.setModAttribute(gameId, modId, "lastSMAPIQuery", now));
	});
}
function init(context) {
	let dependencyManager;
	const getDiscoveryPath = () => {
		const state = context.api.store.getState();
		const discovery = vortex_api.util.getSafe(state, [
			"settings",
			"gameMode",
			"discovered",
			GAME_ID
		], void 0);
		if (discovery === void 0 || discovery.path === void 0) {
			(0, vortex_api.log)("error", "stardewvalley was not discovered");
			return;
		}
		return discovery.path;
	};
	const getSMAPIPath = (game) => {
		return context.api.store.getState().settings.gameMode.discovered[game.id].path;
	};
	const manifestExtractor = toBlue(async (modInfo, modPath) => {
		if (vortex_api.selectors.activeGameId(context.api.getState()) !== GAME_ID) return Promise.resolve({});
		const manifests = await getModManifests(modPath);
		const parsedManifests = (await Promise.all(manifests.map(async (manifest) => {
			try {
				return await parseManifest(manifest);
			} catch (err) {
				(0, vortex_api.log)("warn", "Failed to parse manifest", {
					manifestFile: manifest,
					error: err.message
				});
				return;
			}
		}))).filter((manifest) => manifest !== void 0);
		if (parsedManifests.length === 0) return Promise.resolve({});
		const refManifest = parsedManifests[0];
		const result = {
			additionalLogicalFileNames: parsedManifests.filter((manifest) => manifest.UniqueID !== void 0).map((manifest) => manifest.UniqueID.toLowerCase()),
			minSMAPIVersion: parsedManifests.map((manifest) => manifest.MinimumApiVersion).filter((version) => semver.valid(version)).sort((lhs, rhs) => semver.compare(rhs, lhs))[0]
		};
		if (refManifest !== void 0) {
			if (modInfo.download.modInfo?.nexus?.ids?.modId !== 2400) result["customFileName"] = refManifest.Name;
			if (typeof refManifest.Version === "string") result["manifestVersion"] = refManifest.Version;
		}
		return Promise.resolve(result);
	});
	context.registerGame(new StardewValley(context));
	context.registerReducer(["settings", "SDV"], sdvReducers);
	context.registerSettings("Mods", Settings, () => ({ onMergeConfigToggle: async (profileId, enabled) => {
		if (!enabled) {
			await onRevertFiles(context.api, profileId);
			context.api.sendNotification({
				type: "info",
				message: "Mod configs returned to their respective mods",
				displayMS: 5e3
			});
		}
		context.api.store.dispatch(setMergeConfigs(profileId, enabled));
		return Promise.resolve();
	} }), () => vortex_api.selectors.activeGameId(context.api.getState()) === GAME_ID, 150);
	context.registerInstaller("smapi-installer", 30, testSMAPI, (files, dest) => bluebird.default.resolve(installSMAPI(getDiscoveryPath, files, dest)));
	context.registerInstaller("sdvrootfolder", 50, testRootFolder, installRootFolder);
	context.registerInstaller("stardew-valley-installer", 50, testSupported, (files, destinationPath) => bluebird.default.resolve(install(context.api, dependencyManager, files, destinationPath)));
	context.registerModType("SMAPI", 30, (gameId) => gameId === GAME_ID, getSMAPIPath, isSMAPIModType);
	context.registerModType(MOD_TYPE_CONFIG, 30, (gameId) => gameId === GAME_ID, () => path$1.join(getDiscoveryPath(), defaultModsRelPath()), () => bluebird.default.resolve(false));
	context.registerModType("sdvrootfolder", 25, (gameId) => gameId === GAME_ID, () => getDiscoveryPath(), (instructions) => {
		const copyInstructions = instructions.filter((instr) => instr.type === "copy");
		const hasManifest = copyInstructions.find((instr) => instr.destination.endsWith(MANIFEST_FILE));
		const hasModsFolder = copyInstructions.find((instr) => instr.destination.startsWith(defaultModsRelPath() + path$1.sep)) !== void 0;
		const hasContentFolder = copyInstructions.find((instr) => instr.destination.startsWith("Content" + path$1.sep)) !== void 0;
		return hasManifest ? bluebird.default.resolve(hasContentFolder && hasModsFolder) : bluebird.default.resolve(hasContentFolder);
	});
	registerConfigMod(context);
	context.registerAction("mod-icons", 999, "changelog", {}, "SMAPI Log", () => {
		onShowSMAPILog(context.api);
	}, () => {
		const state = context.api.store.getState();
		return vortex_api.selectors.activeGameId(state) === GAME_ID;
	});
	context.registerAttributeExtractor(25, manifestExtractor);
	context.registerTableAttribute("mods", {
		id: "sdv-compatibility",
		position: 100,
		condition: () => vortex_api.selectors.activeGameId(context.api.getState()) === GAME_ID,
		placement: "table",
		calc: (mod) => mod.attributes?.compatibilityStatus,
		customRenderer: (mod, detailCell, t) => {
			return react.default.createElement(CompatibilityIcon, {
				t,
				mod,
				detailCell
			}, []);
		},
		name: "Compatibility",
		isDefaultVisible: true,
		edit: {}
	});
	context.registerTest("sdv-incompatible-mods", "gamemode-activated", () => bluebird.default.resolve(testSMAPIOutdated(context.api, dependencyManager)));
	context.once(() => {
		const proxy = new SMAPIProxy(context.api);
		context.api.setStylesheet("sdv", path$1.join(__dirname, "sdvstyle.scss"));
		context.api.addMetaServer("smapi.io", {
			url: "",
			loopbackCB: (query) => {
				return bluebird.default.resolve(proxy.find(query)).catch((err) => {
					(0, vortex_api.log)("error", "failed to look up smapi meta info", err.message);
					return bluebird.default.resolve([]);
				});
			},
			cacheDurationSec: 86400,
			priority: 25
		});
		dependencyManager = new DependencyManager(context.api);
		context.api.onAsync("added-files", (profileId, files) => onAddedFiles(context.api, profileId, files));
		context.api.onAsync("will-enable-mods", (profileId, modIds, enabled, options) => onWillEnableMods(context.api, profileId, modIds, enabled, options));
		context.api.onAsync("did-deploy", async (profileId) => {
			const state = context.api.getState();
			if (vortex_api.selectors.profileById(state, profileId)?.gameId !== GAME_ID) return Promise.resolve();
			const smapiMod = findSMAPIMod(context.api);
			const primaryTool = vortex_api.util.getSafe(state, [
				"settings",
				"interface",
				"primaryTool",
				GAME_ID
			], void 0);
			if (smapiMod && primaryTool === void 0) context.api.store.dispatch(vortex_api.actions.setPrimaryTool(GAME_ID, "smapi"));
			return Promise.resolve();
		});
		context.api.onAsync("did-purge", async (profileId) => {
			const state = context.api.getState();
			if (vortex_api.selectors.profileById(state, profileId)?.gameId !== GAME_ID) return Promise.resolve();
			const smapiMod = findSMAPIMod(context.api);
			const primaryTool = vortex_api.util.getSafe(state, [
				"settings",
				"interface",
				"primaryTool",
				GAME_ID
			], void 0);
			if (smapiMod && primaryTool === "smapi") context.api.store.dispatch(vortex_api.actions.setPrimaryTool(GAME_ID, void 0));
			return Promise.resolve();
		});
		context.api.events.on("did-install-mod", (gameId, archiveId, modId) => {
			if (gameId !== GAME_ID) return;
			updateConflictInfo(context.api, proxy, gameId, modId).then(() => (0, vortex_api.log)("debug", "added compatibility info", { modId })).catch((err) => (0, vortex_api.log)("error", "failed to add compatibility info", {
				modId,
				error: err.message
			}));
		});
		context.api.events.on("gamemode-activated", (gameMode) => {
			if (gameMode !== GAME_ID) return;
			const state = context.api.getState();
			(0, vortex_api.log)("debug", "updating SDV compatibility info");
			Promise.all(Object.keys(state.persistent.mods[gameMode] ?? {}).map((modId) => updateConflictInfo(context.api, proxy, gameMode, modId))).then(() => {
				(0, vortex_api.log)("debug", "done updating compatibility info");
			}).catch((err) => {
				(0, vortex_api.log)("error", "failed to update conflict info", err.message);
			});
		});
	});
}

//#endregion
module.exports = init;
//# sourceMappingURL=index.js.map