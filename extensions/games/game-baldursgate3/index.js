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
let react = require("react");
react = __toESM(react);
let vortex_api = require("vortex-api");
let https = require("https");
https = __toESM(https);
let lodash = require("lodash");
lodash = __toESM(lodash);
let semver = require("semver");
semver = __toESM(semver);
let url = require("url");
url = __toESM(url);
let react_bootstrap = require("react-bootstrap");
let react_i18next = require("react-i18next");
let react_redux = require("react-redux");
let redux_act = require("redux-act");
let xml2js = require("xml2js");
let shortid = require("shortid");
let turbowalk = require("turbowalk");
turbowalk = __toESM(turbowalk);
let util = require("util");
util = __toESM(util);
let child_process = require("child_process");
child_process = __toESM(child_process);
let lru_cache = require("lru-cache");
let exe_version = require("exe-version");
exe_version = __toESM(exe_version);

//#region extensions/games/game-baldursgate3/common.ts
const DEFAULT_MOD_SETTINGS_V8 = `<?xml version="1.0" encoding="UTF-8"?>
<save>
    <version major="4" minor="8" revision="0" build="10"/>
    <region id="ModuleSettings">
        <node id="root">
            <children>
                <node id="Mods">
                    <children>
                        <node id="ModuleShortDesc">
                            <attribute id="Folder" type="LSString" value="GustavX"/>
                            <attribute id="MD5" type="LSString" value=""/>
                            <attribute id="Name" type="LSString" value="GustavX"/>
                            <attribute id="PublishHandle" type="uint64" value="0"/>
                            <attribute id="UUID" type="guid" value="cb555efe-2d9e-131f-8195-a89329d218ea"/>
                            <attribute id="Version64" type="int64" value="36028797018963968"/>
                        </node>
                    </children>
                </node>
            </children>
        </node>
    </region>
</save>`;
const DEFAULT_MOD_SETTINGS_V7 = `<?xml version="1.0" encoding="UTF-8"?>
<save>
  <version major="4" minor="7" revision="1" build="200"/>
  <region id="ModuleSettings">
    <node id="root">
      <children>
        <node id="Mods">
          <children>
            <node id="ModuleShortDesc">
              <attribute id="Folder" type="LSString" value="GustavDev"/>
              <attribute id="MD5" type="LSString" value=""/>
              <attribute id="Name" type="LSString" value="GustavDev"/>
              <attribute id="PublishHandle" type="uint64" value="0"/>
              <attribute id="UUID" type="guid" value="28ac9ce2-2aba-8cda-b3b5-6e922f71b6b8"/>
              <attribute id="Version64" type="int64" value="36028797018963968"/>
            </node>
          </children>
        </node>
      </children>
    </node>
  </region>
</save>`;
const DEFAULT_MOD_SETTINGS_V6 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<save>
  <version major="4" minor="0" revision="10" build="100"/>
  <region id="ModuleSettings">
    <node id="root">
      <children>
        <node id="ModOrder">
          <children/>
        </node>
        <node id="Mods">
          <children>
            <node id="ModuleShortDesc">
              <attribute id="Folder" type="LSString" value="GustavDev"/>
              <attribute id="MD5" type="LSString" value=""/>
              <attribute id="Name" type="LSString" value="GustavDev"/>
              <attribute id="UUID" type="FixedString" value="28ac9ce2-2aba-8cda-b3b5-6e922f71b6b8"/>
              <attribute id="Version64" type="int64" value="36028797018963968"/>
            </node>
          </children>
        </node>
      </children>
    </node>
  </region>
</save>`;
const GAME_ID = "baldursgate3";
const DEBUG = false;
const LSLIB_URL = "https://github.com/Norbyte/lslib";
const LO_FILE_NAME = "loadOrder.json";
const IGNORE_PATTERNS = [path.default.join("**", "info.json")];
const MOD_TYPE_LSLIB = "bg3-lslib-divine-tool";
const MOD_TYPE_BG3SE = "bg3-bg3se";
const MOD_TYPE_REPLACER = "bg3-replacer";
const MOD_TYPE_LOOSE = "bg3-loose";
const ORIGINAL_FILES = new Set([
	"assets.pak",
	"assets.pak",
	"effects.pak",
	"engine.pak",
	"engineshaders.pak",
	"game.pak",
	"gameplatform.pak",
	"gustav.pak",
	"gustav_textures.pak",
	"icons.pak",
	"lowtex.pak",
	"materials.pak",
	"minimaps.pak",
	"models.pak",
	"shared.pak",
	"sharedsoundbanks.pak",
	"sharedsounds.pak",
	"textures.pak",
	"virtualtextures.pak"
]);
const LSLIB_FILES = new Set(["divine.exe", "lslib.dll"]);
const NOTIF_IMPORT_ACTIVITY = "bg3-loadorder-import-activity";

//#endregion
//#region extensions/games/game-baldursgate3/githubDownloader.ts
const GITHUB_URL = "https://api.github.com/repos/Norbyte/lslib";
function query(baseUrl, request) {
	return new Promise((resolve, reject) => {
		const getRequest = getRequestOptions(`${baseUrl}/${request}`);
		https.get(getRequest, (res) => {
			res.setEncoding("utf-8");
			const msgHeaders = res.headers;
			const callsRemaining = parseInt(vortex_api.util.getSafe(msgHeaders, ["x-ratelimit-remaining"], "0"), 10);
			if (res.statusCode === 403 && callsRemaining === 0) {
				const resetDate = parseInt(vortex_api.util.getSafe(msgHeaders, ["x-ratelimit-reset"], "0"), 10);
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
	const relUrl = url.parse(link);
	return {
		...lodash.pick(relUrl, [
			"port",
			"hostname",
			"path"
		]),
		headers: { "User-Agent": "Vortex" }
	};
}
async function downloadConsent(api) {
	return api.showDialog("error", "Divine tool is missing", { bbcode: api.translate("Baldur's Gate 3's modding pattern in most (if not all) cases will require a 3rd party tool named \"{{name}}\" to manipulate game files.[br][/br][br][/br]Vortex can download and install this tool for you as a mod entry. Please ensure that the tool is always enabled and deployed on the mods page.[br][/br][br][/br]Please note that some Anti-Virus software may flag this tool as malicious due to the nature of the tool (unpacks .pak files). We suggest you ensure that your security software is configured to allow this tool to install.", { replace: { name: "LSLib" } }) }, [{ label: "Cancel" }, { label: "Download" }]).then((result) => result.action === "Cancel" ? Promise.reject(new vortex_api.util.UserCanceled()) : Promise.resolve());
}
async function notifyUpdate(api, latest, current) {
	vortex_api.selectors.activeGameId(api.store.getState());
	api.translate;
	return new Promise((resolve, reject) => {
		api.sendNotification({
			type: "info",
			id: `divine-update`,
			noDismiss: true,
			allowSuppress: true,
			title: "Update for {{name}}",
			message: "Latest: {{latest}}, Installed: {{current}}",
			replace: {
				latest,
				current
			},
			actions: [{
				title: "More",
				action: (dismiss) => {
					api.showDialog("info", "{{name}} Update", {
						text: "Vortex has detected a newer version of {{name}} ({{latest}}) available to download from {{website}}. You currently have version {{current}} installed.\nVortex can download and attempt to install the new update for you.",
						parameters: {
							name: "LSLib/Divine Tool",
							website: LSLIB_URL,
							latest,
							current
						}
					}, [{
						label: "Download",
						action: () => {
							resolve();
							dismiss();
						}
					}]);
				}
			}, {
				title: "Dismiss",
				action: (dismiss) => {
					resolve();
					dismiss();
				}
			}]
		});
	});
}
async function getLatestReleases(currentVersion) {
	return query(GITHUB_URL, "releases").then((releases) => {
		if (!Array.isArray(releases)) return Promise.reject(new vortex_api.util.DataInvalid("expected array of github releases"));
		const current = releases.filter((rel) => {
			const tagName = vortex_api.util.getSafe(rel, ["tag_name"], void 0);
			const isPreRelease = vortex_api.util.getSafe(rel, ["prerelease"], false);
			const version = semver.valid(tagName);
			return !isPreRelease && version !== null && (currentVersion === void 0 || semver.gte(version, currentVersion));
		}).sort((lhs, rhs) => semver.compare(rhs.tag_name, lhs.tag_name));
		return Promise.resolve(current);
	});
}
async function startDownload(api, downloadLink) {
	const redirectionURL = await new Promise((resolve, reject) => {
		https.request(getRequestOptions(downloadLink), (res) => {
			return resolve(res.headers["location"]);
		}).on("error", (err) => reject(err)).end();
	});
	const dlInfo = {
		game: GAME_ID,
		name: "LSLib/Divine Tool"
	};
	api.events.emit("start-download", [redirectionURL], dlInfo, void 0, (error, id) => {
		if (error !== null) if (error.name === "AlreadyDownloaded" && error.downloadId !== void 0) id = error.downloadId;
		else {
			api.showErrorNotification("Download failed", error, { allowReport: false });
			return Promise.resolve();
		}
		api.events.emit("start-install-download", id, true, (err, modId) => {
			if (err !== null) api.showErrorNotification("Failed to install LSLib", err, { allowReport: false });
			const state = api.getState();
			const profileId = vortex_api.selectors.lastActiveProfileForGame(state, GAME_ID);
			api.store.dispatch(vortex_api.actions.setModEnabled(profileId, modId, true));
			return Promise.resolve();
		});
	}, "ask");
}
async function resolveDownloadLink(currentReleases) {
	const downloadLink = currentReleases[0].assets.filter((asset) => asset.name.match(/(ExportTool-v[0-9]+.[0-9]+.[0-9]+.zip)/i))[0]?.browser_download_url;
	return downloadLink === void 0 ? Promise.reject(new vortex_api.util.DataInvalid("Failed to resolve browser download url")) : Promise.resolve(downloadLink);
}
async function checkForUpdates(api, currentVersion) {
	return getLatestReleases(currentVersion).then(async (currentReleases) => {
		if (currentReleases[0] === void 0) {
			(0, vortex_api.log)("error", "Unable to update LSLib", "Failed to find any releases");
			return Promise.resolve(currentVersion);
		}
		const mostRecentVersion = currentReleases[0].tag_name.slice(1);
		const downloadLink = await resolveDownloadLink(currentReleases);
		if (semver.valid(mostRecentVersion) === null) return Promise.resolve(currentVersion);
		else if (semver.gt(mostRecentVersion, currentVersion)) return notifyUpdate(api, mostRecentVersion, currentVersion).then(() => startDownload(api, downloadLink)).then(() => Promise.resolve(mostRecentVersion));
		else return Promise.resolve(currentVersion);
	}).catch((err) => {
		if (err instanceof vortex_api.util.UserCanceled || err instanceof vortex_api.util.ProcessCanceled) return Promise.resolve(currentVersion);
		api.showErrorNotification("Unable to update LSLib", err);
		return Promise.resolve(currentVersion);
	});
}
async function downloadDivine(api) {
	const state = api.store.getState();
	vortex_api.selectors.activeGameId(state);
	return getLatestReleases(void 0).then(async (currentReleases) => {
		const downloadLink = await resolveDownloadLink(currentReleases);
		return downloadConsent(api).then(() => startDownload(api, downloadLink));
	}).catch((err) => {
		if (err instanceof vortex_api.util.UserCanceled || err instanceof vortex_api.util.ProcessCanceled) return Promise.resolve();
		else {
			api.showErrorNotification("Unable to download/install LSLib", err);
			return Promise.resolve();
		}
	});
}

//#endregion
//#region extensions/games/game-baldursgate3/actions.ts
const setAutoExportLoadOrder = (0, redux_act.createAction)("BG3_SETTINGS_AUTO_EXPORT", (enabled) => enabled);
const setMigration = (0, redux_act.createAction)("BG3_SET_MIGRATION", (enabled) => enabled);
const setPlayerProfile = (0, redux_act.createAction)("BG3_SET_PLAYERPROFILE", (name) => name);
const settingsWritten = (0, redux_act.createAction)("BG3_SETTINGS_WRITTEN", (profile, time, count) => ({
	profile,
	time,
	count
}));
const setBG3ExtensionVersion = (0, redux_act.createAction)("BG3_SET_EXTENSION_VERSION", (version) => ({ version }));

//#endregion
//#region extensions/games/game-baldursgate3/Settings.tsx
function Settings() {
	const store = (0, react_redux.useStore)();
	const autoExportLoadOrder = (0, react_redux.useSelector)((state) => state.settings["baldursgate3"]?.autoExportLoadOrder);
	const setUseAutoExportLoadOrderToGame = react.default.useCallback((enabled) => {
		console.log(`setAutoExportLoadOrder=${enabled}`);
		store.dispatch(setAutoExportLoadOrder(enabled));
	}, []);
	const { t } = (0, react_i18next.useTranslation)();
	return /* @__PURE__ */ react.default.createElement("form", null, /* @__PURE__ */ react.default.createElement(react_bootstrap.FormGroup, { controlId: "default-enable" }, /* @__PURE__ */ react.default.createElement(react_bootstrap.Panel, null, /* @__PURE__ */ react.default.createElement(react_bootstrap.Panel.Body, null, /* @__PURE__ */ react.default.createElement(react_bootstrap.ControlLabel, null, t("Baldur's Gate 3")), /* @__PURE__ */ react.default.createElement(vortex_api.Toggle, {
		checked: autoExportLoadOrder,
		onToggle: setUseAutoExportLoadOrderToGame
	}, t("Auto export load order")), /* @__PURE__ */ react.default.createElement(react_bootstrap.HelpBlock, null, t(`If enabled, when Vortex saves it's load order, it will also update the games load order. 
              If disabled, and you wish the game to use your load order, then this will need to be completed 
              manually using the Export to Game button on the load order screen`))))));
}

//#endregion
//#region extensions/games/game-baldursgate3/reducers.ts
const reducer = {
	reducers: {
		[setMigration]: (state, payload) => vortex_api.util.setSafe(state, ["migration"], payload),
		[setAutoExportLoadOrder]: (state, payload) => vortex_api.util.setSafe(state, ["autoExportLoadOrder"], payload),
		[setPlayerProfile]: (state, payload) => vortex_api.util.setSafe(state, ["playerProfile"], payload),
		[setBG3ExtensionVersion]: (state, payload) => vortex_api.util.setSafe(state, ["extensionVersion"], payload.version),
		[settingsWritten]: (state, payload) => {
			const { profile, time, count } = payload;
			return vortex_api.util.setSafe(state, ["settingsWritten", profile], {
				time,
				count
			});
		}
	},
	defaults: {
		migration: true,
		autoExportLoadOrder: true,
		playerProfile: "global",
		settingsWritten: {},
		extensionVersion: "0.0.0"
	}
};

//#endregion
//#region extensions/games/game-baldursgate3/util.ts
function getGamePath(api) {
	return api.getState().settings.gameMode.discovered?.[GAME_ID]?.path;
}
function getGameDataPath(api) {
	const gamePath = api.getState().settings.gameMode.discovered?.[GAME_ID]?.path;
	if (gamePath !== void 0) return path.join(gamePath, "Data");
	else return;
}
function documentsPath() {
	return path.join(vortex_api.util.getVortexPath("localAppData"), "Larian Studios", "Baldur's Gate 3");
}
function modsPath() {
	return path.join(documentsPath(), "Mods");
}
function profilesPath() {
	return path.join(documentsPath(), "PlayerProfiles");
}
async function globalProfilePath(api) {
	const bg3ProfileId = await getActivePlayerProfile(api);
	return path.join(documentsPath(), bg3ProfileId);
}
const getPlayerProfiles = (() => {
	let cached = [];
	try {
		cached = vortex_api.fs.readdirSync(profilesPath()).filter((name) => path.extname(name) === "" && name !== "Default");
	} catch (err) {
		if (err.code !== "ENOENT") throw err;
	}
	return () => cached;
})();
function gameSupportsProfile(gameVersion) {
	return semver.lt(semver.coerce(gameVersion), "4.1.206");
}
async function getOwnGameVersion(state) {
	const discovery = vortex_api.selectors.discoveryByGame(state, GAME_ID);
	return await vortex_api.util.getGame(GAME_ID).getInstalledVersion(discovery);
}
async function getActivePlayerProfile(api) {
	return gameSupportsProfile(await getOwnGameVersion(api.getState())) ? api.store.getState().settings.baldursgate3?.playerProfile || "global" : "Public";
}
function parseModNode(node) {
	const name = findNode(node.attribute, "Name").$.value;
	return {
		id: name,
		name,
		data: findNode(node.attribute, "UUID").$.value
	};
}
const resolveMeta = (metadata) => {
	return metadata !== void 0 ? typeof metadata === "string" ? metadata : JSON.stringify(metadata) : void 0;
};
function logError(message, metadata) {
	(0, vortex_api.log)("debug", message, resolveMeta(metadata));
}
function logDebug(message, metadata) {
	if (DEBUG) (0, vortex_api.log)("debug", message, resolveMeta(metadata));
}
function forceRefresh(api) {
	const state = api.getState();
	const action = {
		type: "SET_FB_FORCE_UPDATE",
		payload: { profileId: vortex_api.selectors.lastActiveProfileForGame(state, GAME_ID) }
	};
	api.store.dispatch(action);
}
function findNode(nodes, id) {
	return nodes?.find((iter) => iter.$.id === id) ?? void 0;
}
function getLatestInstalledLSLibVer(api) {
	const state = api.getState();
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID
	], {});
	return Object.keys(mods).reduce((prev, id) => {
		if (mods[id].type === "bg3-lslib-divine-tool") {
			const arcId = mods[id].archiveId;
			const dl = vortex_api.util.getSafe(state, [
				"persistent",
				"downloads",
				"files",
				arcId
			], void 0);
			const storedVer = vortex_api.util.getSafe(mods[id], ["attributes", "version"], "0.0.0");
			try {
				if (semver.gt(storedVer, prev)) prev = storedVer;
			} catch (err) {
				(0, vortex_api.log)("warn", "invalid version stored for lslib mod", {
					id,
					version: storedVer
				});
			}
			if (dl !== void 0) {
				const fileName = path.basename(dl.localPath, path.extname(dl.localPath));
				const idx = fileName.indexOf("-v");
				try {
					const ver = semver.coerce(fileName.slice(idx + 2)).version;
					if (semver.valid(ver) && ver !== storedVer) {
						api.store.dispatch(vortex_api.actions.setModAttribute(GAME_ID, id, "version", ver));
						prev = ver;
					}
				} catch (err) {
					api.store.dispatch(vortex_api.actions.setModAttribute(GAME_ID, id, "version", "1.0.0"));
					prev = "1.0.0";
				}
			}
		}
		return prev;
	}, "0.0.0");
}
let _FORMAT = null;
const PATCH_8 = "4.67.58";
const PATCH_7 = "4.58.49";
const PATCH_6 = "4.50.22";
async function getDefaultModSettingsFormat(api) {
	if (_FORMAT !== null) return _FORMAT;
	_FORMAT = "v8";
	try {
		const gameVersion = await getOwnGameVersion(api.getState());
		const coerced = gameVersion ? semver.coerce(gameVersion) : PATCH_8;
		if (semver.gte(coerced, PATCH_8)) _FORMAT = "v8";
		else if (semver.gte(coerced, PATCH_7)) _FORMAT = "v7";
		else if (semver.gte(coerced, PATCH_6)) _FORMAT = "v6";
		else _FORMAT = "pre-v6";
	} catch (err) {
		(0, vortex_api.log)("warn", "failed to get game version", err);
	}
	return _FORMAT;
}
async function getDefaultModSettings(api) {
	if (_FORMAT === null) _FORMAT = await getDefaultModSettingsFormat(api);
	return {
		"v8": DEFAULT_MOD_SETTINGS_V8,
		"v7": DEFAULT_MOD_SETTINGS_V7,
		"v6": DEFAULT_MOD_SETTINGS_V6,
		"pre-v6": DEFAULT_MOD_SETTINGS_V6
	}[_FORMAT];
}
async function convertToV8(someXml) {
	const v7Json = await (0, xml2js.parseStringPromise)(await convertV6toV7(someXml));
	v7Json.save.version[0].$.major = "4";
	v7Json.save.version[0].$.minor = "8";
	v7Json.save.version[0].$.revision = "0";
	v7Json.save.version[0].$.build = "10";
	const modsNode = v7Json.save.region[0].node[0].children[0].node.find((n) => n.$.id === "Mods");
	if (modsNode) {
		var gustavEntry = modsNode.children[0].node.find((n) => n.attribute.some((attr) => attr.$.id === "Name" && attr.$.value === "GustavDev"));
		if (gustavEntry) gustavEntry.attribute = [
			{ $: {
				id: "Folder",
				type: "LSString",
				value: "GustavX"
			} },
			{ $: {
				id: "MD5",
				type: "LSString",
				value: ""
			} },
			{ $: {
				id: "Name",
				type: "LSString",
				value: "GustavX"
			} },
			{ $: {
				id: "PublishHandle",
				type: "uint64",
				value: "0"
			} },
			{ $: {
				id: "UUID",
				type: "guid",
				value: "cb555efe-2d9e-131f-8195-a89329d218ea"
			} },
			{ $: {
				id: "Version64",
				type: "int64",
				value: "36028797018963968"
			} }
		];
	}
	return new xml2js.Builder().buildObject(v7Json);
}
async function convertV6toV7(v6Xml) {
	const v6Json = await (0, xml2js.parseStringPromise)(v6Xml);
	v6Json.save.version[0].$.major = "4";
	v6Json.save.version[0].$.minor = "7";
	v6Json.save.version[0].$.revision = "1";
	v6Json.save.version[0].$.build = "3";
	const moduleSettingsChildren = v6Json.save.region[0].node[0].children[0].node;
	const modOrderIndex = moduleSettingsChildren.findIndex((n) => n.$.id === "ModOrder");
	if (modOrderIndex !== -1) moduleSettingsChildren.splice(modOrderIndex, 1);
	const modsNode = moduleSettingsChildren.find((n) => n.$.id === "Mods");
	if (modsNode) for (let i = 0; i < modsNode.children[0].node.length; i++) {
		const moduleShortDescNode = modsNode.children[0].node[i];
		if (moduleShortDescNode) {
			const uuidAttribute = moduleShortDescNode.attribute.find((attr) => attr.$.id === "UUID");
			if (uuidAttribute) uuidAttribute.$.type = "guid";
			if (moduleShortDescNode.attribute.find((attr) => attr.$.id === "PublishHandle") === void 0) moduleShortDescNode.attribute.push({ $: {
				id: "publishHandle",
				type: "uint64",
				value: "0"
			} });
		}
	}
	return new xml2js.Builder().buildObject(v6Json);
}
function getLatestLSLibMod$1(api) {
	const mods = api.getState().persistent.mods[GAME_ID];
	if (mods === void 0) {
		(0, vortex_api.log)("warn", "LSLib is not installed");
		return;
	}
	const lsLib = Object.keys(mods).reduce((prev, id) => {
		if (mods[id].type === MOD_TYPE_LSLIB) {
			const latestVer = vortex_api.util.getSafe(prev, ["attributes", "version"], "0.0.0");
			const currentVer = vortex_api.util.getSafe(mods[id], ["attributes", "version"], "0.0.0");
			try {
				if (semver.gt(currentVer, latestVer)) prev = mods[id];
			} catch (err) {
				(0, vortex_api.log)("warn", "invalid mod version", {
					modId: id,
					version: currentVer
				});
			}
		}
		return prev;
	}, void 0);
	if (lsLib === void 0) {
		(0, vortex_api.log)("warn", "LSLib is not installed");
		return;
	}
	return lsLib;
}
async function extractPakInfoImpl(api, pakPath, mod, isListed) {
	const moduleInfo = findNode(findNode(findNode((await extractMeta(api, pakPath, mod))?.save?.region, "Config")?.node, "root")?.children?.[0]?.node, "ModuleInfo");
	const attr = (name, fallback) => findNode(moduleInfo?.attribute, name)?.$?.value ?? fallback();
	const genName = path.basename(pakPath, path.extname(pakPath));
	return {
		author: attr("Author", () => "Unknown"),
		description: attr("Description", () => "Missing"),
		folder: attr("Folder", () => genName),
		md5: attr("MD5", () => ""),
		name: attr("Name", () => genName),
		type: attr("Type", () => "Adventure"),
		uuid: attr("UUID", () => require("uuid").v4()),
		version: attr("Version64", () => "1"),
		publishHandle: attr("PublishHandle", () => "0"),
		isListed
	};
}
async function extractMeta(api, pakPath, mod) {
	const metaPath = path.join(vortex_api.util.getVortexPath("temp"), "lsmeta", (0, shortid.generate)());
	await vortex_api.fs.ensureDirAsync(metaPath);
	await extractPak(api, pakPath, metaPath, "*/meta.lsx");
	try {
		let metaLSXPath = path.join(metaPath, "meta.lsx");
		await (0, turbowalk.default)(metaPath, (entries) => {
			const temp = entries.find((e) => path.basename(e.filePath).toLowerCase() === "meta.lsx");
			if (temp !== void 0) metaLSXPath = temp.filePath;
		});
		const meta = await (0, xml2js.parseStringPromise)(await vortex_api.fs.readFileAsync(metaLSXPath));
		await vortex_api.fs.removeAsync(metaPath);
		return meta;
	} catch (err) {
		await vortex_api.fs.removeAsync(metaPath);
		if (err.code === "ENOENT") return Promise.resolve(void 0);
		else if (err.message.includes("Column") && err.message.includes("Line")) {
			api.sendNotification({
				type: "warning",
				message: "The meta.lsx file in \"{{modName}}\" is invalid, please report this to the author",
				actions: [{
					title: "More",
					action: () => {
						api.showDialog("error", "Invalid meta.lsx file", { message: err.message }, [{ label: "Close" }]);
					}
				}],
				replace: { modName: vortex_api.util.renderModName(mod) }
			});
			return Promise.resolve(void 0);
		} else throw err;
	}
}
async function parseLSXFile(lsxPath) {
	return (0, xml2js.parseStringPromise)(await vortex_api.fs.readFileAsync(lsxPath, { encoding: "utf8" }));
}
async function readModSettings$1(api) {
	const bg3profile = await getActivePlayerProfile(api);
	if (getPlayerProfiles().length === 0) return parseLSXFile(path.join(profilesPath(), "Public", "modsettings.lsx"));
	const globalProfile = await globalProfilePath(api);
	return parseLSXFile(bg3profile !== "global" ? path.join(profilesPath(), bg3profile, "modsettings.lsx") : path.join(globalProfile, "modsettings.lsx"));
}
async function readStoredLO(api) {
	const configRoot = findNode(findNode((await readModSettings$1(api))?.save?.region, "ModuleSettings")?.node, "root");
	const modOrderRoot = findNode(configRoot?.children?.[0]?.node, "ModOrder");
	const modsRoot = findNode(configRoot?.children?.[0]?.node, "Mods");
	const modOrderNodes = modOrderRoot?.children?.[0]?.node ?? [];
	const modNodes = modsRoot?.children?.[0]?.node ?? [];
	const modOrder = modOrderNodes.map((node) => findNode(node.attribute, "UUID").$?.value);
	const state = api.store.getState();
	const vProfile = vortex_api.selectors.activeProfile(state);
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID
	], {});
	const enabled = Object.keys(mods).filter((id) => vortex_api.util.getSafe(vProfile, [
		"modState",
		id,
		"enabled"
	], false));
	const bg3profile = state.settings.baldursgate3?.playerProfile;
	if (enabled.length > 0 && modNodes.length === 1) {
		const lastWrite = state.settings.baldursgate3?.settingsWritten?.[bg3profile];
		if (lastWrite !== void 0 && lastWrite.count > 1) api.showDialog("info", "\"modsettings.lsx\" file was reset", { text: "The game reset the list of active mods and ran without them.\nThis happens when an invalid or incompatible mod is installed. The game will not load any mods if one of them is incompatible, unfortunately there is no easy way to find out which one caused the problem." }, [{ label: "Continue" }]);
	}
	modNodes.map((node) => parseModNode(node)).filter((entry) => !entry.id.startsWith("Gustav")).sort((lhs, rhs) => modOrder.findIndex((i) => i === lhs.data) - modOrder.findIndex((i) => i === rhs.data));
}

//#endregion
//#region extensions/games/game-baldursgate3/divineWrapper.ts
const exec = util.promisify(child_process.exec);
const concurrencyLimiter = new vortex_api.util.ConcurrencyLimiter(5, () => true);
const TIMEOUT_MS = 1e4;
var DivineExecMissing = class extends Error {
	constructor() {
		super("Divine executable is missing");
		this.name = "DivineExecMissing";
	}
};
var DivineMissingDotNet = class extends Error {
	constructor() {
		super("LSLib requires .NET 8 Desktop Runtime to be installed.");
		this.name = "DivineMissingDotNet";
	}
};
const execOpts = { timeout: TIMEOUT_MS };
async function runDivine(api, action, divineOpts) {
	return new Promise((resolve, reject) => concurrencyLimiter.do(async () => {
		try {
			return resolve(await divine(api, action, divineOpts, execOpts));
		} catch (err) {
			return reject(err);
		}
	}));
}
async function divine(api, action, divineOpts, execOpts) {
	return new Promise(async (resolve, reject) => {
		const state = api.getState();
		const stagingFolder = vortex_api.selectors.installPathForGame(state, GAME_ID);
		const lsLib = getLatestLSLibMod$1(api);
		if (lsLib === void 0) {
			const err = /* @__PURE__ */ new Error("LSLib/Divine tool is missing");
			err["attachLogOnReport"] = false;
			return reject(err);
		}
		const exe = path.join(stagingFolder, lsLib.installationPath, "tools", "divine.exe");
		const args = [
			"--action",
			action,
			"--source",
			`"${divineOpts.source}"`,
			"--game",
			"bg3"
		];
		if (divineOpts.loglevel !== void 0) args.push("--loglevel", divineOpts.loglevel);
		else args.push("--loglevel", "off");
		if (divineOpts.destination !== void 0) args.push("--destination", `"${divineOpts.destination}"`);
		if (divineOpts.expression !== void 0) args.push("--expression", `"${divineOpts.expression}"`);
		try {
			const { stdout, stderr } = await exec(`"${exe}" ${args.join(" ")}`, execOpts);
			if (!!stderr) return reject(/* @__PURE__ */ new Error(`divine.exe failed: ${stderr}`));
			if (!stdout && action !== "list-package") return resolve({
				stdout: "",
				returnCode: 2
			});
			const stdoutStr = typeof stdout === "string" ? stdout : stdout?.toString?.() ?? "";
			if (["error", "fatal"].some((x) => stdoutStr.toLowerCase().startsWith(x))) return reject(/* @__PURE__ */ new Error(`divine.exe failed: ${stdoutStr}`));
			else return resolve({
				stdout: stdoutStr,
				returnCode: 0
			});
		} catch (err) {
			if (err.code === "ENOENT") return reject(new DivineExecMissing());
			if (err.message.includes("You must install or update .NET")) return reject(new DivineMissingDotNet());
			const error = /* @__PURE__ */ new Error(`divine.exe failed: ${err.message}`);
			error["attachLogOnReport"] = true;
			return reject(error);
		}
	});
}
async function extractPak(api, pakPath, destPath, pattern) {
	return runDivine(api, "extract-package", {
		source: pakPath,
		destination: destPath,
		expression: pattern
	});
}
async function listPackage(api, pakPath) {
	let res;
	try {
		res = await runDivine(api, "list-package", {
			source: pakPath,
			loglevel: "off"
		});
	} catch (error) {
		logError(`listPackage caught error: `, { error });
		if (error instanceof DivineMissingDotNet) {
			(0, vortex_api.log)("error", "Missing .NET", error.message);
			api.dismissNotification("bg3-reading-paks-activity");
			api.showErrorNotification("LSLib requires .NET 8", "LSLib requires .NET 8 Desktop Runtime to be installed.[br][/br][br][/br][list=1][*]Download and Install [url=https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-desktop-8.0.3-windows-x64-installer].NET 8.0 Desktop Runtime from Microsoft[/url][*]Close Vortex[*]Restart Computer[*]Open Vortex[/list]", {
				id: "bg3-dotnet-error",
				allowReport: false,
				isBBCode: true
			});
		}
	}
	return (res?.stdout || "").split("\n").map((line) => line.trim()).filter((line) => line.length !== 0);
}

//#endregion
//#region extensions/games/game-baldursgate3/cache.ts
var PakInfoCache = class PakInfoCache {
	static {
		this.instance = null;
	}
	static getInstance(api) {
		if (!PakInfoCache.instance) PakInfoCache.instance = new PakInfoCache(api);
		return PakInfoCache.instance;
	}
	constructor(api) {
		this.mApi = api;
		this.mCache = new lru_cache.LRUCache({ max: 700 });
		this.load(api);
	}
	async getCacheEntry(api, filePath, mod) {
		const id = this.fileId(filePath);
		const ctime = (await vortex_api.fs.statAsync(filePath)).ctimeMs;
		const hasChanged = (entry) => {
			return !!mod && !!entry.mod ? mod.attributes?.fileId !== entry.mod.attributes?.fileId : ctime !== entry?.lastModified;
		};
		const cacheEntry = await this.mCache.get(id);
		const packageNotListed = (cacheEntry?.packageList || []).length === 0;
		if (!cacheEntry || hasChanged(cacheEntry) || packageNotListed) {
			const packageList = await listPackage(api, filePath);
			const isListed = this.isLOListed(api, filePath, packageList);
			const info = await extractPakInfoImpl(api, filePath, mod, isListed);
			this.mCache.set(id, {
				fileName: path.basename(filePath),
				lastModified: ctime,
				info,
				packageList,
				mod,
				isListed
			});
		}
		return this.mCache.get(id);
	}
	reset() {
		this.mCache = new lru_cache.LRUCache({ max: 700 });
		this.save();
	}
	async save() {
		if (!this.mCache) return;
		const state = this.mApi.getState();
		const profileId = vortex_api.selectors.lastActiveProfileForGame(state, GAME_ID);
		const staging = vortex_api.selectors.installPathForGame(state, GAME_ID);
		const cachePath = path.join(path.dirname(staging), "cache", profileId + ".json");
		try {
			await vortex_api.fs.ensureDirWritableAsync(path.dirname(cachePath));
			const cacheData = Array.from(this.mCache.entries());
			await vortex_api.util.writeFileAtomic(cachePath, JSON.stringify(cacheData));
		} catch (err) {
			(0, vortex_api.log)("error", "failed to save cache", err);
			return;
		}
	}
	async load(api) {
		const state = api.getState();
		const profileId = vortex_api.selectors.lastActiveProfileForGame(state, GAME_ID);
		const staging = vortex_api.selectors.installPathForGame(state, GAME_ID);
		const cachePath = path.join(path.dirname(staging), "cache", profileId + ".json");
		try {
			await vortex_api.fs.ensureDirWritableAsync(path.dirname(cachePath));
			const data = await vortex_api.fs.readFileAsync(cachePath, { encoding: "utf8" });
			const cacheData = JSON.parse(data);
			if (Array.isArray(cacheData)) for (const [key, value] of cacheData) this.mCache.set(key, value);
		} catch (err) {
			if (!["ENOENT"].includes(err.code)) (0, vortex_api.log)("error", "failed to load cache", err);
		}
	}
	isLOListed(api, pakPath, packageList) {
		try {
			return !(packageList.find((line) => path.basename(line.split("	")[0]).toLowerCase() === "meta.lsx") !== void 0 ? true : false);
		} catch (err) {
			api.sendNotification({
				type: "error",
				message: `${path.basename(pakPath)} couldn't be read correctly. This mod be incorrectly locked/unlocked but will default to unlocked.`
			});
			return false;
		}
	}
	fileId(filePath) {
		return path.basename(filePath).toUpperCase();
	}
};

//#endregion
//#region extensions/games/game-baldursgate3/loadOrder.ts
async function serialize(context, loadOrder, profileId) {
	const props = genProps(context);
	if (props === void 0) return Promise.reject(new vortex_api.util.ProcessCanceled("invalid props"));
	const state = context.api.getState();
	const loFilePath = await ensureLOFile(context, profileId, props);
	logDebug("serialize loadOrder=", loadOrder);
	await vortex_api.fs.removeAsync(loFilePath).catch({ code: "ENOENT" }, () => Promise.resolve());
	await vortex_api.fs.writeFileAsync(loFilePath, JSON.stringify(loadOrder), { encoding: "utf8" });
	const autoExportToGame = state.settings["baldursgate3"].autoExportLoadOrder ?? false;
	logDebug("serialize autoExportToGame=", autoExportToGame);
	if (autoExportToGame) await exportToGame(context.api);
	return Promise.resolve();
}
async function deserialize(context) {
	const props = genProps(context);
	if (props?.profile?.gameId !== GAME_ID) return [];
	const paks = await readPAKs(context.api);
	const loFilePath = await ensureLOFile(context);
	const fileData = await vortex_api.fs.readFileAsync(loFilePath, { encoding: "utf8" });
	let loadOrder = [];
	try {
		try {
			loadOrder = JSON.parse(fileData);
		} catch (err) {
			(0, vortex_api.log)("error", "Corrupt load order file", err);
			await new Promise((resolve, reject) => {
				props.api.showDialog("error", "Corrupt load order file", { bbcode: props.api.translate("The load order file is in a corrupt state. You can try to fix it yourself or Vortex can regenerate the file for you, but that may result in loss of data (Will only affect load order items you added manually, if any).") }, [{
					label: "Cancel",
					action: () => reject(err)
				}, {
					label: "Regenerate File",
					action: async () => {
						await vortex_api.fs.removeAsync(loFilePath).catch({ code: "ENOENT" }, () => Promise.resolve());
						loadOrder = [];
						return resolve();
					}
				}]);
			});
		}
		logDebug("deserialize loadOrder=", loadOrder);
		const filteredLoadOrder = loadOrder.filter((entry) => paks.find((pak) => pak.fileName === entry.id));
		logDebug("deserialize filteredLoadOrder=", filteredLoadOrder);
		const processedPaks = paks.reduce((acc, curr) => {
			acc.valid.push(curr);
			return acc;
		}, {
			valid: [],
			invalid: []
		});
		logDebug("deserialize processedPaks=", processedPaks);
		const addedMods = processedPaks.valid.filter((pak) => filteredLoadOrder.find((entry) => entry.id === pak.fileName) === void 0);
		logDebug("deserialize addedMods=", addedMods);
		logDebug("deserialize paks=", paks);
		addedMods.forEach((pak) => {
			filteredLoadOrder.push({
				id: pak.fileName,
				modId: pak.mod?.id,
				enabled: true,
				name: pak.info?.name || path.default.basename(pak.fileName, ".pak"),
				data: pak.info,
				locked: pak.info.isListed
			});
		});
		return filteredLoadOrder.sort((a, b) => +b.locked - +a.locked);
	} catch (err) {
		return Promise.reject(err);
	}
}
async function importFromBG3MM(context) {
	const api = context.api;
	const options = {
		title: api.translate("Please choose a BG3MM .json load order file to import from"),
		filters: [{
			name: "BG3MM Load Order",
			extensions: ["json"]
		}]
	};
	const selectedPath = await api.selectFile(options);
	logDebug("importFromBG3MM selectedPath=", selectedPath);
	if (selectedPath === void 0) return;
	try {
		const data = await vortex_api.fs.readFileAsync(selectedPath, { encoding: "utf8" });
		const loadOrder = JSON.parse(data);
		logDebug("importFromBG3MM loadOrder=", loadOrder);
		const getIndex = (uuid) => {
			const index = loadOrder.findIndex((entry) => entry.UUID !== void 0 && entry.UUID === uuid);
			return index !== -1 ? index : Infinity;
		};
		const state = api.getState();
		const profileId = vortex_api.selectors.activeProfile(state)?.id;
		await serialize(context, [...vortex_api.util.getSafe(state, [
			"persistent",
			"loadOrder",
			profileId
		], [])].sort((a, b) => getIndex(a.data?.uuid) - getIndex(b.data?.uuid)), profileId);
	} catch (err) {
		api.showErrorNotification("Failed to import BG3MM load order file", err, { allowReport: false });
	} finally {
		forceRefresh(context.api);
	}
}
async function importModSettingsFile(api) {
	const state = api.getState();
	vortex_api.selectors.activeProfile(state)?.id;
	const options = {
		title: api.translate("Please choose a BG3 .lsx file to import from"),
		filters: [{
			name: "BG3 Load Order",
			extensions: ["lsx"]
		}]
	};
	const selectedPath = await api.selectFile(options);
	logDebug("importModSettingsFile selectedPath=", selectedPath);
	if (selectedPath === void 0) return;
	processLsxFile(api, selectedPath);
}
async function importModSettingsGame(api) {
	const bg3ProfileId = await getActivePlayerProfile(api);
	const gameSettingsPath = path.default.join(profilesPath(), bg3ProfileId, "modsettings.lsx");
	logDebug("importModSettingsGame gameSettingsPath=", gameSettingsPath);
	processLsxFile(api, gameSettingsPath);
}
function checkIfDuplicateExists(arr) {
	return new Set(arr).size !== arr.length;
}
async function getNodes(lsxPath) {
	const lsxLoadOrder = await readLsxFile(lsxPath);
	logDebug("processLsxFile lsxPath=", lsxPath);
	const region = findNode(lsxLoadOrder?.save?.region, "ModuleSettings");
	const root = findNode(region?.node, "root");
	return {
		region,
		root,
		modsNode: findNode(root?.children?.[0]?.node, "Mods"),
		modsOrderNode: findNode(root?.children?.[0]?.node, "ModOrder")
	};
}
async function processLsxFile(api, lsxPath) {
	const state = api.getState();
	const profileId = vortex_api.selectors.activeProfile(state)?.id;
	api.sendNotification({
		id: NOTIF_IMPORT_ACTIVITY,
		title: "Importing LSX File",
		message: lsxPath,
		type: "activity",
		noDismiss: true,
		allowSuppress: false
	});
	try {
		const { modsNode, modsOrderNode } = await getNodes(lsxPath);
		if (modsNode?.children === void 0 || modsNode?.children[0] === "") modsNode.children = [{ node: [] }];
		const format = await getDefaultModSettingsFormat(api);
		let loNode = ["v7", "v8"].includes(format) ? modsNode : modsOrderNode !== void 0 ? modsOrderNode : modsNode;
		let uuidArray = loNode?.children !== void 0 ? loNode.children[0].node.map((loEntry) => loEntry.attribute.find((attr) => attr.$.id === "UUID").$.value) : [];
		logDebug(`processLsxFile uuidArray=`, uuidArray);
		if (checkIfDuplicateExists(uuidArray)) {
			api.sendNotification({
				type: "warning",
				id: "bg3-loadorder-imported-duplicate",
				title: "Duplicate Entries",
				message: "Duplicate UUIDs found in the ModOrder section of the .lsx file being imported. This sometimes can cause issues with the load order."
			});
			uuidArray = Array.from(new Set(uuidArray));
		}
		const lsxModNodes = modsNode.children[0].node;
		logDebug(`processLsxFile lsxModNodes=`, lsxModNodes);
		const paks = await readPAKs(api);
		const missing = paks.reduce((acc, curr) => {
			if (curr.mod === void 0) return acc;
			if (lsxModNodes.find((lsxEntry) => lsxEntry.attribute.find((attr) => attr.$.id === "Name" && attr.$.value === curr.info.name)) === void 0) acc.push(curr);
			return acc;
		}, []);
		logDebug("processLsxFile - missing pak files that have associated mods =", missing);
		let newLoadOrder = lsxModNodes.reduce((acc, curr) => {
			const pak = paks.find((pak) => pak.info.name === curr.attribute.find((attr) => attr.$.id === "Name").$.value);
			if (pak !== void 0) acc.push({
				id: pak.fileName,
				modId: pak?.mod?.id,
				enabled: true,
				name: pak.info?.name || path.default.basename(pak.fileName, ".pak"),
				data: pak.info,
				locked: pak.info.isListed
			});
			return acc;
		}, []);
		logDebug("processLsxFile (before adding missing) newLoadOrder=", newLoadOrder);
		missing.forEach((pak) => {
			newLoadOrder.push({
				id: pak.fileName,
				modId: pak?.mod?.id,
				enabled: true,
				name: pak.info?.name || path.default.basename(pak.fileName, ".pak"),
				data: pak.info,
				locked: pak.info.isListed
			});
		});
		logDebug("processLsxFile (after adding missing) newLoadOrder=", newLoadOrder);
		newLoadOrder.sort((a, b) => +b.locked - +a.locked);
		logDebug("processLsxFile (after sorting) newLoadOrder=", newLoadOrder);
		api.store.dispatch(vortex_api.actions.setFBLoadOrder(profileId, newLoadOrder));
		api.dismissNotification("bg3-loadorder-import-activity");
		api.sendNotification({
			type: "success",
			id: "bg3-loadorder-imported",
			title: "Load Order Imported",
			message: lsxPath,
			displayMS: 3e3
		});
		logDebug("processLsxFile finished");
	} catch (err) {
		api.dismissNotification(NOTIF_IMPORT_ACTIVITY);
		api.showErrorNotification("Failed to import load order", err, { allowReport: false });
	}
}
async function exportTo(api, filepath) {
	const state = api.getState();
	const profileId = vortex_api.selectors.activeProfile(state)?.id;
	const loadOrder = vortex_api.util.getSafe(api.getState(), [
		"persistent",
		"loadOrder",
		profileId
	], []);
	logDebug("exportTo loadOrder=", loadOrder);
	try {
		const modSettings = await readModSettings(api);
		const modSettingsFormat = await getDefaultModSettingsFormat(api);
		const root = findNode(findNode(modSettings?.save?.region, "ModuleSettings")?.node, "root");
		const modsNode = findNode(root?.children?.[0]?.node, "Mods");
		if (modsNode.children === void 0 || modsNode.children[0] === "") modsNode.children = [{ node: [] }];
		const descriptionNodes = modsNode?.children?.[0]?.node?.filter?.((iter) => iter.attribute.find((attr) => attr.$.id === "Name" && attr.$.value.startsWith("Gustav"))) ?? [];
		const filteredPaks = loadOrder.filter((entry) => !!entry.data?.uuid && entry.enabled && !entry.data?.isListed);
		logDebug("exportTo filteredPaks=", filteredPaks);
		for (const entry of filteredPaks) {
			const attributeOrder = [
				"Folder",
				"MD5",
				"Name",
				"PublishHandle",
				"UUID",
				"Version64",
				"Version"
			];
			const attributes = ["v7", "v8"].includes(modSettingsFormat) ? [
				{ $: {
					id: "Folder",
					type: "LSString",
					value: entry.data.folder
				} },
				{ $: {
					id: "Name",
					type: "LSString",
					value: entry.data.name
				} },
				{ $: {
					id: "PublishHandle",
					type: "uint64",
					value: 0
				} },
				{ $: {
					id: "Version64",
					type: "int64",
					value: entry.data.version
				} },
				{ $: {
					id: "UUID",
					type: "guid",
					value: entry.data.uuid
				} }
			] : [
				{ $: {
					id: "Folder",
					type: "LSWString",
					value: entry.data.folder
				} },
				{ $: {
					id: "Name",
					type: "FixedString",
					value: entry.data.name
				} },
				{ $: {
					id: "UUID",
					type: "FixedString",
					value: entry.data.uuid
				} },
				{ $: {
					id: "Version",
					type: "int32",
					value: entry.data.version
				} }
			];
			descriptionNodes.push({
				$: { id: "ModuleShortDesc" },
				attribute: [].concat(attributes, [{ $: {
					id: "MD5",
					type: "LSString",
					value: entry.data.md5
				} }]).sort((a, b) => attributeOrder.indexOf(a.$.id) - attributeOrder.indexOf(b.$.id))
			});
		}
		const loadOrderNodes = filteredPaks.map((entry) => ({
			$: { id: "Module" },
			attribute: [{ $: {
				id: "UUID",
				type: "FixedString",
				value: entry.data.uuid
			} }]
		}));
		modsNode.children[0].node = descriptionNodes;
		if (!["v7", "v8"].includes(modSettingsFormat)) {
			let modOrderNode = findNode(root?.children?.[0]?.node, "ModOrder");
			let insertNode = false;
			if (!modOrderNode) {
				insertNode = true;
				modOrderNode = {
					$: { id: "ModOrder" },
					children: [{ node: [] }]
				};
			}
			if (modOrderNode.children === void 0 || modOrderNode.children[0] === "") modOrderNode.children = [{ node: [] }];
			modOrderNode.children[0].node = loadOrderNodes;
			if (insertNode && !!root?.children?.[0]?.node) root?.children?.[0]?.node.splice(0, 0, modOrderNode);
		}
		writeModSettings(api, modSettings, filepath);
		api.sendNotification({
			type: "success",
			id: "bg3-loadorder-exported",
			title: "Load Order Exported",
			message: filepath,
			displayMS: 3e3
		});
	} catch (err) {
		api.showErrorNotification("Failed to write load order", err, {
			allowReport: false,
			message: "Please run the game at least once and create a profile in-game"
		});
	}
}
async function exportToFile(api) {
	let selectedPath;
	if (api.saveFile !== void 0) {
		const options = {
			title: api.translate("Please choose a BG3 .lsx file to export to"),
			filters: [{
				name: "BG3 Load Order",
				extensions: ["lsx"]
			}]
		};
		selectedPath = await api.saveFile(options);
	} else {
		const options = {
			title: api.translate("Please choose a BG3 .lsx file to export to"),
			filters: [{
				name: "BG3 Load Order",
				extensions: ["lsx"]
			}],
			create: true
		};
		selectedPath = await api.selectFile(options);
	}
	logDebug(`exportToFile ${selectedPath}`);
	if (selectedPath === void 0) return;
	exportTo(api, selectedPath);
}
async function exportToGame(api) {
	const bg3ProfileId = await getActivePlayerProfile(api);
	const settingsPath = path.default.join(profilesPath(), bg3ProfileId, "modsettings.lsx");
	logDebug(`exportToGame ${settingsPath}`);
	exportTo(api, settingsPath);
}
async function readModSettings(api) {
	const bg3ProfileId = await getActivePlayerProfile(api);
	const settingsPath = path.default.join(profilesPath(), bg3ProfileId, "modsettings.lsx");
	const dat = await vortex_api.fs.readFileAsync(settingsPath, { encoding: "utf8" });
	logDebug("readModSettings", dat);
	return (0, xml2js.parseStringPromise)(dat);
}
async function readLsxFile(lsxPath) {
	const dat = await vortex_api.fs.readFileAsync(lsxPath);
	logDebug("lsxPath", dat);
	return (0, xml2js.parseStringPromise)(dat);
}
async function writeModSettings(api, data, filepath) {
	const format = await getDefaultModSettingsFormat(api);
	const xml = (["v7", "v8"].includes(format) ? new xml2js.Builder({ renderOpts: {
		pretty: true,
		indent: "    "
	} }) : new xml2js.Builder()).buildObject(data);
	try {
		await vortex_api.fs.ensureDirWritableAsync(path.default.dirname(filepath));
		await vortex_api.fs.writeFileAsync(filepath, xml);
	} catch (err) {
		api.showErrorNotification("Failed to write mod settings", err);
		return;
	}
}
async function validate(prev, current) {}
async function readPAKs(api) {
	const state = api.getState();
	if (getLatestLSLibMod(api) === void 0) return [];
	const paks = await readPAKList(api);
	let manifest;
	try {
		manifest = await vortex_api.util.getManifest(api, "", GAME_ID);
	} catch (err) {
		const allowReport = !["EPERM"].includes(err.code);
		api.showErrorNotification("Failed to read deployment manifest", err, { allowReport });
		return [];
	}
	api.sendNotification({
		type: "activity",
		id: "bg3-reading-paks-activity",
		message: "Reading PAK files. This might take a while..."
	});
	const cache = PakInfoCache.getInstance(api);
	const res = await Promise.all(paks.map(async (fileName, idx) => {
		return vortex_api.util.withErrorContext("reading pak", fileName, () => {
			const func = async () => {
				try {
					const manifestEntry = manifest.files.find((entry) => entry.relPath === fileName);
					const mod = manifestEntry !== void 0 ? state.persistent.mods[GAME_ID]?.[manifestEntry.source] : void 0;
					const pakPath = path.default.join(modsPath(), fileName);
					return cache.getCacheEntry(api, pakPath, mod);
				} catch (err) {
					if (err instanceof DivineExecMissing) {
						api.showErrorNotification("Divine executable is missing", "The installed copy of LSLib/Divine is corrupted - please delete the existing LSLib mod entry and re-install it. Make sure to disable or add any necessary exceptions to your security software to ensure it does not interfere with Vortex/LSLib file operations.", { allowReport: false });
						return;
					}
					if (err.code !== "ENOENT") api.showErrorNotification("Failed to read pak. Please make sure you are using the latest version of LSLib by using the \"Re-install LSLib/Divine\" toolbar button on the Mods page.", err, {
						allowReport: false,
						message: fileName
					});
					return;
				}
			};
			return bluebird.default.resolve(func());
		});
	}));
	api.dismissNotification("bg3-reading-paks-activity");
	return res.filter((iter) => iter !== void 0);
}
async function readPAKList(api) {
	let paks;
	try {
		paks = (await vortex_api.fs.readdirAsync(modsPath())).filter((fileName) => path.default.extname(fileName).toLowerCase() === ".pak");
	} catch (err) {
		if (err.code === "ENOENT") try {
			await vortex_api.fs.ensureDirWritableAsync(modsPath(), () => Promise.resolve());
		} catch (err) {}
		else api.showErrorNotification("Failed to read mods directory", err, {
			id: "bg3-failed-read-mods",
			message: modsPath()
		});
		paks = [];
	}
	return paks;
}
function getLatestLSLibMod(api) {
	const mods = api.getState().persistent.mods[GAME_ID];
	if (mods === void 0) {
		(0, vortex_api.log)("warn", "LSLib is not installed");
		return;
	}
	const lsLib = Object.keys(mods).reduce((prev, id) => {
		if (mods[id].type === "bg3-lslib-divine-tool") {
			const latestVer = vortex_api.util.getSafe(prev, ["attributes", "version"], "0.0.0");
			const currentVer = vortex_api.util.getSafe(mods[id], ["attributes", "version"], "0.0.0");
			try {
				if (semver.gt(currentVer, latestVer)) prev = mods[id];
			} catch (err) {
				(0, vortex_api.log)("warn", "invalid mod version", {
					modId: id,
					version: currentVer
				});
			}
		}
		return prev;
	}, void 0);
	if (lsLib === void 0) {
		(0, vortex_api.log)("warn", "LSLib is not installed");
		return;
	}
	return lsLib;
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
	const targetPath = loadOrderFilePath(props.profile.id);
	try {
		try {
			await vortex_api.fs.statAsync(targetPath);
		} catch (err) {
			await vortex_api.fs.writeFileAsync(targetPath, JSON.stringify([]), { encoding: "utf8" });
		}
	} catch (err) {
		return Promise.reject(err);
	}
	return targetPath;
}
function loadOrderFilePath(profileId) {
	return path.default.join(vortex_api.util.getVortexPath("userData"), GAME_ID, profileId + "_" + LO_FILE_NAME);
}

//#endregion
//#region extensions/games/game-baldursgate3/migrations.tsx
async function migrate(api) {
	const bg3ProfileId = await getActivePlayerProfile(api);
	const settingsPath = path.default.join(profilesPath(), bg3ProfileId, "modsettings.lsx");
	const backupPath = settingsPath + ".backup";
	const currentVersion = vortex_api.util.getSafe(api.getState(), [
		"settings",
		"baldursgate3",
		"extensionVersion"
	], "0.0.0");
	try {
		await vortex_api.fs.statAsync(backupPath);
	} catch (err) {
		logDebug(`${backupPath} doesn't exist.`);
		try {
			await vortex_api.fs.statAsync(settingsPath);
			await vortex_api.fs.copyAsync(settingsPath, backupPath, { overwrite: true });
			logDebug(`backup created`);
			await importModSettingsGame(api);
		} catch (err) {
			logDebug(`${settingsPath} doesn't exist`);
		}
	} finally {
		await migrate15(api, currentVersion);
	}
}
async function migrate15(api, oldVersion) {
	const newVersion = "1.5.0";
	if (!DEBUG && semver.gte(oldVersion, newVersion)) {
		logDebug("skipping migration");
		return Promise.resolve();
	}
	await importModSettingsGame(api);
	const t = api.translate;
	const batched = [setBG3ExtensionVersion(newVersion)];
	api.sendNotification({
		id: "bg3-patch7-info",
		type: "info",
		message: "Baldur's Gate 3 patch 7",
		allowSuppress: true,
		actions: [{
			title: "More",
			action: (dismiss) => {
				api.showDialog("info", "Baldur's Gate 3 patch 7", { bbcode: t("As of Baldur's Gate 3 patch 7, the \"ModFixer\" mod is no longer required. Please feel free to disable it.{{bl}}Additional information about patch 7 troubleshooting can be found here: [url]{{url}}[/url]{{bl}}Please note - if you switch between different game versions/patches - make sure to purge your mods and run the game at least once so that the game can regenerate your \"modsettings.lsx\" file.", { replace: {
					bl: "[br][/br][br][/br]",
					url: "https://wiki.bg3.community/en/Tutorials/patch7-troubleshooting"
				} }) }, [{
					label: "Close",
					action: () => {
						batched.push(vortex_api.actions.suppressNotification("bg3-patch7-info", true));
						dismiss();
					}
				}]);
			}
		}]
	});
	vortex_api.util.batchDispatch(api.store, batched);
}

//#endregion
//#region extensions/games/game-baldursgate3/installers.ts
async function testLSLib(files, gameId) {
	if (gameId !== GAME_ID) return Promise.resolve({
		supported: false,
		requiredFiles: []
	});
	const matchedFiles = files.filter((file) => LSLIB_FILES.has(path.basename(file).toLowerCase()));
	return Promise.resolve({
		supported: matchedFiles.length >= 2,
		requiredFiles: []
	});
}
async function testModFixer(files, gameId) {
	const notSupported = {
		supported: false,
		requiredFiles: []
	};
	if (gameId !== GAME_ID) return Promise.resolve(notSupported);
	if (!(files.map((file) => file.toLowerCase()).find((file) => path.basename(file) === "modfixer.pak") !== void 0)) return Promise.resolve(notSupported);
	return Promise.resolve({
		supported: true,
		requiredFiles: []
	});
}
async function testEngineInjector(files, gameId) {
	const notSupported = {
		supported: false,
		requiredFiles: []
	};
	if (gameId !== GAME_ID) return Promise.resolve(notSupported);
	if (!(files.map((file) => file.toLowerCase()).find((file) => file.indexOf("bin" + path.sep) !== -1) !== void 0)) return Promise.resolve(notSupported);
	return Promise.resolve({
		supported: true,
		requiredFiles: []
	});
}
async function installBG3SE(files) {
	logDebug("installBG3SE files:", files);
	files = files.filter((f) => path.extname(f) !== "" && !f.endsWith(path.sep));
	files = files.filter((f) => path.extname(f) === ".dll");
	const instructions = files.reduce((accum, filePath) => {
		accum.push({
			type: "copy",
			source: filePath,
			destination: path.basename(filePath)
		});
		return accum;
	}, []);
	logDebug("installBG3SE instructions:", instructions);
	return Promise.resolve({ instructions });
}
async function installModFixer(files) {
	logDebug("installModFixer files:", files);
	files = files.filter((f) => path.extname(f) !== "" && !f.endsWith(path.sep));
	files = files.filter((f) => path.extname(f) === ".pak");
	const instructions = files.reduce((accum, filePath) => {
		accum.push({
			type: "copy",
			source: filePath,
			destination: path.basename(filePath)
		});
		return accum;
	}, [{
		type: "attribute",
		key: "modFixer",
		value: true
	}]);
	logDebug("installModFixer instructions:", instructions);
	return Promise.resolve({ instructions });
}
async function installEngineInjector(files) {
	logDebug("installEngineInjector files:", files);
	files = files.filter((f) => path.extname(f) !== "" && !f.endsWith(path.sep));
	const instructions = files.reduce((accum, filePath) => {
		const binIndex = filePath.toLowerCase().indexOf("bin" + path.sep);
		if (binIndex !== -1) {
			logDebug(filePath.substring(binIndex));
			accum.push({
				type: "copy",
				source: filePath,
				destination: filePath.substring(binIndex)
			});
		}
		return accum;
	}, [{
		type: "setmodtype",
		value: "dinput"
	}]);
	logDebug("installEngineInjector instructions:", instructions);
	return Promise.resolve({ instructions });
}
async function installLSLib(files, destinationPath) {
	const exe = files.find((file) => path.basename(file.toLowerCase()) === "divine.exe");
	let ver = await (0, exe_version.default)(path.join(destinationPath, exe));
	ver = ver.split(".").slice(0, 3).join(".");
	const fileName = path.basename(destinationPath, path.extname(destinationPath));
	const idx = fileName.indexOf("-v");
	const fileNameVer = fileName.slice(idx + 2);
	if (semver.valid(fileNameVer) && ver !== fileNameVer) ver = fileNameVer;
	const versionAttr = {
		type: "attribute",
		key: "version",
		value: ver
	};
	const instructions = files.reduce((accum, filePath) => {
		if (filePath.toLowerCase().split(path.sep).indexOf("tools") !== -1 && !filePath.endsWith(path.sep)) accum.push({
			type: "copy",
			source: filePath,
			destination: path.join("tools", path.basename(filePath))
		});
		return accum;
	}, [{
		type: "setmodtype",
		value: "bg3-lslib-divine-tool"
	}, versionAttr]);
	return Promise.resolve({ instructions });
}
async function testBG3SE(files, gameId) {
	if (gameId !== GAME_ID) return Promise.resolve({
		supported: false,
		requiredFiles: []
	});
	const hasDWriteDll = files.find((file) => path.basename(file).toLowerCase() === "dwrite.dll") !== void 0;
	return Promise.resolve({
		supported: hasDWriteDll,
		requiredFiles: []
	});
}
function testReplacer(files, gameId) {
	if (gameId !== GAME_ID) return Promise.resolve({
		supported: false,
		requiredFiles: []
	});
	const paks = files.filter((file) => path.extname(file).toLowerCase() === ".pak");
	const hasGenOrPublicFolder = ["generated", "public"].some((segment) => files.find((file) => file.toLowerCase().indexOf(segment + path.sep) !== -1) !== void 0);
	return Promise.resolve({
		supported: hasGenOrPublicFolder || paks.length === 0,
		requiredFiles: []
	});
}
async function installReplacer(files) {
	const directories = Array.from(new Set(files.map((file) => path.dirname(file).toUpperCase())));
	let dataPath = void 0;
	const genOrPublic = directories.find((dir) => ["PUBLIC", "GENERATED"].includes(path.basename(dir)));
	if (genOrPublic !== void 0) dataPath = path.dirname(genOrPublic);
	if (dataPath === void 0) dataPath = directories.find((dir) => path.basename(dir) === "DATA");
	const instructions = dataPath !== void 0 ? files.reduce((prev, filePath) => {
		if (filePath.endsWith(path.sep)) return prev;
		const relPath = path.relative(dataPath, filePath);
		if (!relPath.startsWith("..")) prev.push({
			type: "copy",
			source: filePath,
			destination: relPath
		});
		return prev;
	}, []) : files.map((filePath) => ({
		type: "copy",
		source: filePath,
		destination: filePath
	}));
	return Promise.resolve({ instructions });
}

//#endregion
//#region extensions/games/game-baldursgate3/modTypes.ts
async function isLSLib(files) {
	return files.find((iter) => iter.type === "copy" && LSLIB_FILES.has(path.basename(iter.destination).toLowerCase())) !== void 0 ? Promise.resolve(true) : Promise.resolve(false);
}
async function isBG3SE(files) {
	return files.find((iter) => iter.type === "copy" && path.basename(iter.destination).toLowerCase() === "dwrite.dll") !== void 0 ? Promise.resolve(true) : Promise.resolve(false);
}
async function isLoose(instructions) {
	const copyInstructions = instructions.filter((instr) => instr.type === "copy");
	const hasDataFolder = copyInstructions.find((instr) => instr.source.indexOf("Data" + path.sep) !== -1) !== void 0;
	const hasGenOrPublicFolder = copyInstructions.find((instr) => instr.source.indexOf("Generated" + path.sep) !== -1 || instr.source.indexOf("Public" + path.sep) !== -1) !== void 0;
	logDebug("isLoose", {
		instructions,
		hasDataFolder: hasDataFolder || hasGenOrPublicFolder
	});
	return Promise.resolve(hasDataFolder || hasGenOrPublicFolder);
}
async function isReplacer(api, files) {
	const origFile = files.find((iter) => iter.type === "copy" && ORIGINAL_FILES.has(iter.destination.toLowerCase()));
	logDebug("isReplacer", {
		origFile,
		paks: files.filter((iter) => iter.type === "copy" && path.extname(iter.destination).toLowerCase() === ".pak")
	});
	if (origFile !== void 0) return api.showDialog("question", "Mod looks like a replacer", { bbcode: "The mod you just installed looks like a \"replacer\", meaning it is intended to replace one of the files shipped with the game.<br/>You should be aware that such a replacer includes a copy of some game data from a specific version of the game and may therefore break as soon as the game gets updated.<br/>Even if doesn't break, it may revert bugfixes that the game developers have made.<br/><br/>Therefore [color=\"red\"]please take extra care to keep this mod updated[/color] and remove it when it no longer matches the game version." }, [{ label: "Install as Mod (will likely not work)" }, {
		label: "Install as Replacer",
		default: true
	}]).then((result) => result.action === "Install as Replacer");
	else return Promise.resolve(false);
}

//#endregion
//#region extensions/games/game-baldursgate3/InfoPanel.tsx
function InfoPanelWrap(props) {
	const { api, getOwnGameVersion, readStoredLO, installLSLib, getLatestLSLibMod } = props;
	const currentProfile = (0, react_redux.useSelector)((state) => state.settings["baldursgate3"]?.playerProfile);
	const [gameVersion, setGameVersion] = react.useState();
	react.useEffect(() => {
		(async () => {
			if (!gameVersion) setGameVersion(await getOwnGameVersion(api.getState()));
		})();
	}, [gameVersion, setGameVersion]);
	const onSetProfile = react.useCallback((profileName) => {
		const impl = async () => {
			api.store.dispatch(setPlayerProfile(profileName));
			try {
				await readStoredLO(api);
			} catch (err) {
				api.showErrorNotification("Failed to read load order", err, {
					message: "Please run the game before you start modding",
					allowReport: false
				});
			}
			forceRefresh(api);
		};
		impl();
	}, [api]);
	const isLsLibInstalled = react.useCallback(() => {
		return getLatestLSLibMod(api) !== void 0;
	}, [api]);
	const onInstallLSLib = react.useCallback(() => {
		installLSLib(api, GAME_ID);
	}, [api]);
	if (!gameVersion) return null;
	return /* @__PURE__ */ react.createElement(InfoPanel, {
		t: api.translate,
		gameVersion,
		currentProfile,
		onSetPlayerProfile: onSetProfile,
		isLsLibInstalled,
		onInstallLSLib
	});
}
function InfoPanel(props) {
	const { t, onInstallLSLib, isLsLibInstalled } = props;
	return isLsLibInstalled() ? /* @__PURE__ */ react.createElement("div", { style: {
		display: "flex",
		flexDirection: "column",
		gap: "12px",
		marginRight: "16px"
	} }, /* @__PURE__ */ react.createElement(react_bootstrap.Alert, {
		bsStyle: "warning",
		style: {
			display: "flex",
			flexDirection: "column",
			gap: "8px"
		}
	}, /* @__PURE__ */ react.createElement("div", null, t("To successfully switch between different game versions/patches please follow these steps:"), /* @__PURE__ */ react.createElement("ul", null, /* @__PURE__ */ react.createElement("li", null, t("Purge your mods")), /* @__PURE__ */ react.createElement("li", null, t("Run the game so that the modsettings.lsx file gets reset to the default values")), /* @__PURE__ */ react.createElement("li", null, t("Close the game")), /* @__PURE__ */ react.createElement("li", null, t("Deploy your mods")), /* @__PURE__ */ react.createElement("li", null, t("Run the game again - your load order will be maintained"))))), /* @__PURE__ */ react.createElement("div", null, t(`A backup is made of the game's modsettings.lsx file before anything is changed.
        This can be found at %APPDATA%\\Local\\Larian Studios\\Baldur's Gate 3\\PlayerProfiles\\Public\\modsettings.lsx.backup`)), /* @__PURE__ */ react.createElement("div", null, t(`Drag and Drop PAK files to reorder how the game loads them. Please note, some mods contain multiple PAK files.`)), /* @__PURE__ */ react.createElement("div", null, t(`Mod descriptions from mod authors may have information to determine the best order.`)), /* @__PURE__ */ react.createElement("div", null, t(`Some mods may be locked in this list because they are loaded differently by the game and can therefore not be load-ordered by mod managers. 
        If you need to disable such a mod, please do so in Vortex\'s Mods page.`)), /* @__PURE__ */ react.createElement("h4", { style: { margin: 0 } }, t("Import and Export")), /* @__PURE__ */ react.createElement("div", null, t(`Import is an experimental tool to help migration from a game load order (.lsx file) to Vortex. It works by importing the game's modsettings file
        and attempts to match up mods that have been installed by Vortex.`)), /* @__PURE__ */ react.createElement("div", null, t(`Export can be used to manually update the game's modsettings.lsx file if 'Settings > Mods > Auto export load order' isn't set to do this automatically. 
        It can also be used to export to a different file as a backup.`)), /* @__PURE__ */ react.createElement("h4", { style: { margin: 0 } }, t("Import from Baldur's Gate 3 Mod Manager")), /* @__PURE__ */ react.createElement("div", null, t("Vortex can sort your load order based on a BG3MM .json load order file. Any mods that are not installed through Vortex will be ignored.")), /* @__PURE__ */ react.createElement("div", null, t("Please note that any mods that are not present in the BG3MM load order file will be placed at the bottom of the load order."))) : /* @__PURE__ */ react.createElement("div", { style: {
		display: "flex",
		flexDirection: "column",
		gap: "12px"
	} }, /* @__PURE__ */ react.createElement("h4", { style: { margin: 0 } }, t("LSLib is not installed")), /* @__PURE__ */ react.createElement("div", null, t("To take full advantage of Vortex's Baldurs Gate 3 modding capabilities such as managing the order in which mods are loaded into the game; Vortex requires a 3rd party tool called LSLib.")), /* @__PURE__ */ react.createElement("div", null, t("Please install the library using the buttons below to manage your load order.")), /* @__PURE__ */ react.createElement(vortex_api.tooltip.Button, {
		tooltip: "Install LSLib",
		onClick: onInstallLSLib
	}, t("Install LSLib")));
}

//#endregion
//#region extensions/games/game-baldursgate3/index.tsx
/**
* Important - although we no longer define the info panel here,
*  we still need to keep the index file's '.tsx' extension.
*  At least while our update process for bundled plugins remains
*  through the 'release' branch.
* 
* Removing files from bundled plugins without stubbing the extension
*  can potentially break the extension on the user's end.
*/
const STOP_PATTERNS = ["[^/]*\\.pak$"];
const GOG_ID = "1456460669";
const STEAM_ID = "1086940";
function toWordExp(input) {
	return "(^|/)" + input + "(/|$)";
}
function findGame() {
	return vortex_api.util.GameStoreHelper.findByAppId([GOG_ID, STEAM_ID]).then((game) => game.gamePath);
}
async function ensureGlobalProfile(api, discovery) {
	if (discovery?.path) {
		const profilePath = await globalProfilePath(api);
		try {
			await vortex_api.fs.ensureDirWritableAsync(profilePath);
			const modSettingsFilePath = path.join(profilePath, "modsettings.lsx");
			try {
				await vortex_api.fs.statAsync(modSettingsFilePath);
			} catch (err) {
				const defaultModSettings = await getDefaultModSettings(api);
				await vortex_api.fs.writeFileAsync(modSettingsFilePath, defaultModSettings, { encoding: "utf8" });
			}
		} catch (err) {
			return Promise.reject(err);
		}
	}
}
async function prepareForModding(api, discovery) {
	const mp = modsPath();
	const format = await getDefaultModSettingsFormat(api);
	if (!["v7", "v8"].includes(format)) showFullReleaseModFixerRecommendation(api);
	return vortex_api.fs.statAsync(mp).catch(() => vortex_api.fs.ensureDirWritableAsync(mp, () => bluebird.default.resolve())).finally(() => ensureGlobalProfile(api, discovery));
}
function showFullReleaseModFixerRecommendation(api) {
	const mods = api.store.getState().persistent?.mods?.baldursgate3;
	if (mods !== void 0) {
		const modArray = mods ? Object.values(mods) : [];
		logDebug("modArray", modArray);
		const modFixerInstalled = modArray.filter((mod) => !!mod?.attributes?.modFixer).length != 0;
		logDebug("modFixerInstalled", modFixerInstalled);
		if (modFixerInstalled) return;
	}
	api.sendNotification({
		type: "warning",
		title: "Recommended Mod",
		message: "Most mods require this mod.",
		id: "bg3-recommended-mod",
		allowSuppress: true,
		actions: [{
			title: "More",
			action: (dismiss) => {
				api.showDialog("question", "Recommended Mods", { text: "We recommend installing \"Baldur's Gate 3 Mod Fixer\" to be able to mod Baldur's Gate 3.\n\nThis can be downloaded from Nexus Mods and installed using Vortex by pressing \"Open Nexus Mods" }, [{ label: "Dismiss" }, {
					label: "Open Nexus Mods",
					default: true
				}]).then((result) => {
					dismiss();
					if (result.action === "Open Nexus Mods") vortex_api.util.opn("https://www.nexusmods.com/baldursgate3/mods/141?tab=description").catch(() => null);
					else if (result.action === "Cancel") {}
					return Promise.resolve();
				});
			}
		}]
	});
}
async function onCheckModVersion(api, gameId, mods) {
	if (vortex_api.selectors.activeProfile(api.getState()).gameId !== GAME_ID || gameId !== GAME_ID) return;
	const latestVer = getLatestInstalledLSLibVer(api);
	if (latestVer === "0.0.0") return;
	const newestVer = await checkForUpdates(api, latestVer);
	if (!newestVer || newestVer === latestVer) return;
}
async function onGameModeActivated(api, gameId) {
	if (gameId !== GAME_ID) {
		PakInfoCache.getInstance(api).save();
		return;
	}
	try {
		await migrate(api);
		const bg3ProfileId = await getActivePlayerProfile(api);
		const gameSettingsPath = path.join(profilesPath(), bg3ProfileId, "modsettings.lsx");
		const { modsNode, modsOrderNode } = await getNodes(gameSettingsPath);
		if (modsNode.children === void 0 || modsNode.children[0] === "") modsNode.children = [{ node: [] }];
		const format = await getDefaultModSettingsFormat(api);
		if (modsOrderNode === void 0 && ["v7", "v8"].includes(format)) {
			const newData = await (format === "v7" ? convertV6toV7 : convertToV8)(await vortex_api.fs.readFileAsync(gameSettingsPath, { encoding: "utf8" }));
			await vortex_api.fs.removeAsync(gameSettingsPath).catch((err) => Promise.resolve());
			await vortex_api.fs.writeFileAsync(gameSettingsPath, newData, { encoding: "utf8" });
		}
	} catch (err) {
		api.showErrorNotification("Failed to migrate", err, { allowReport: false });
	}
	try {
		await readStoredLO(api);
		PakInfoCache.getInstance(api);
	} catch (err) {
		api.showErrorNotification("Failed to read load order", err, {
			message: "Please run the game before you start modding",
			allowReport: false
		});
	}
	if (getLatestInstalledLSLibVer(api) === "0.0.0") await downloadDivine(api);
}
function main(context) {
	context.registerReducer(["settings", "baldursgate3"], reducer);
	context.registerGame({
		id: GAME_ID,
		name: "Baldur's Gate 3",
		mergeMods: true,
		queryPath: findGame,
		supportedTools: [{
			id: "exevulkan",
			name: "Baldur's Gate 3 (Vulkan)",
			executable: () => "bin/bg3.exe",
			requiredFiles: ["bin/bg3.exe"],
			relative: true
		}],
		queryModPath: modsPath,
		logo: "gameart.jpg",
		executable: () => "bin/bg3_dx11.exe",
		setup: (discovery) => prepareForModding(context.api, discovery),
		requiredFiles: ["bin/bg3_dx11.exe"],
		environment: { SteamAPPId: STEAM_ID },
		details: {
			steamAppId: +STEAM_ID,
			stopPatterns: STOP_PATTERNS.map(toWordExp),
			ignoreConflicts: IGNORE_PATTERNS,
			ignoreDeploy: IGNORE_PATTERNS
		}
	});
	context.registerAction("mod-icons", 300, "settings", {}, "Re-install LSLib/Divine", () => {
		const state = context.api.getState();
		const mods = vortex_api.util.getSafe(state, [
			"persistent",
			"mods",
			GAME_ID
		], {});
		const lslibs = Object.keys(mods).filter((mod) => mods[mod].type === "bg3-lslib-divine-tool");
		context.api.events.emit("remove-mods", GAME_ID, lslibs, (err) => {
			if (err !== null) {
				context.api.showErrorNotification("Failed to reinstall lslib", "Please re-install manually", { allowReport: false });
				return;
			}
			downloadDivine(context.api);
		});
	}, () => {
		const state = context.api.store.getState();
		return vortex_api.selectors.activeGameId(state) === GAME_ID;
	});
	context.registerInstaller("bg3-lslib-divine-tool", 15, testLSLib, installLSLib);
	context.registerInstaller("bg3-bg3se", 15, testBG3SE, installBG3SE);
	context.registerInstaller("bg3-engine-injector", 20, testEngineInjector, installEngineInjector);
	context.registerInstaller("bg3-replacer", 25, testReplacer, installReplacer);
	context.registerInstaller("bg3-modfixer", 25, testModFixer, installModFixer);
	context.registerModType(MOD_TYPE_LSLIB, 15, (gameId) => gameId === GAME_ID, () => void 0, isLSLib, {
		name: "BG3 LSLib",
		noConflicts: true
	});
	context.registerModType(MOD_TYPE_BG3SE, 15, (gameId) => gameId === GAME_ID, () => path.join(getGamePath(context.api), "bin"), isBG3SE, { name: "BG3 BG3SE" });
	context.registerModType(MOD_TYPE_LOOSE, 20, (gameId) => gameId === GAME_ID, () => getGameDataPath(context.api), isLoose, { name: "BG3 Loose" });
	context.registerModType(MOD_TYPE_REPLACER, 25, (gameId) => gameId === GAME_ID, () => getGameDataPath(context.api), (instructions) => isReplacer(context.api, instructions), { name: "BG3 Replacer" });
	context.registerLoadOrder({
		clearStateOnPurge: false,
		gameId: GAME_ID,
		deserializeLoadOrder: () => deserialize(context),
		serializeLoadOrder: (loadOrder, prev) => serialize(context, loadOrder),
		validate,
		toggleableEntries: false,
		usageInstructions: (() => /* @__PURE__ */ react.createElement(InfoPanelWrap, {
			api: context.api,
			getOwnGameVersion,
			readStoredLO,
			installLSLib: onGameModeActivated,
			getLatestLSLibMod: getLatestLSLibMod$1
		}))
	});
	const isBG3 = () => {
		const state = context.api.getState();
		return vortex_api.selectors.activeGameId(state) === GAME_ID;
	};
	context.registerAction("fb-load-order-icons", 150, "changelog", {}, "Export to Game", () => {
		exportToGame(context.api);
	}, isBG3);
	context.registerAction("fb-load-order-icons", 151, "changelog", {}, "Export to File...", () => {
		exportToFile(context.api);
	}, isBG3);
	context.registerAction("fb-load-order-icons", 160, "import", {}, "Import from Game", () => {
		importModSettingsGame(context.api);
	}, isBG3);
	context.registerAction("fb-load-order-icons", 161, "import", {}, "Import from File...", () => {
		importModSettingsFile(context.api);
	}, isBG3);
	context.registerAction("fb-load-order-icons", 170, "import", {}, "Import from BG3MM...", () => {
		importFromBG3MM(context);
	}, isBG3);
	context.registerAction("fb-load-order-icons", 190, "open-ext", {}, "Open Load Order File", () => {
		getActivePlayerProfile(context.api).then((bg3ProfileId) => {
			const gameSettingsPath = path.join(profilesPath(), bg3ProfileId, "modsettings.lsx");
			vortex_api.util.opn(gameSettingsPath).catch(() => null);
		});
	}, isBG3);
	context.registerSettings("Mods", Settings, void 0, isBG3, 150);
	context.once(() => {
		context.api.onStateChange([
			"session",
			"base",
			"toolsRunning"
		], (prev, current) => {
			if (vortex_api.selectors.activeGameId(context.api.getState()) === GAME_ID && Object.keys(current).length === 0) readStoredLO(context.api).catch((err) => {
				context.api.showErrorNotification("Failed to read load order", err, {
					message: "Please run the game before you start modding",
					allowReport: false
				});
			});
		});
		context.api.onAsync("did-deploy", async (profileId, deployment) => {
			if (vortex_api.selectors.profileById(context.api.getState(), profileId)?.gameId === GAME_ID) forceRefresh(context.api);
			await PakInfoCache.getInstance(context.api).save();
			return Promise.resolve();
		});
		context.api.events.on("check-mods-version", (gameId, mods) => onCheckModVersion(context.api, gameId, mods));
		context.api.events.on("gamemode-activated", async (gameMode) => onGameModeActivated(context.api, gameMode));
	});
	return true;
}

//#endregion
module.exports = main;
//# sourceMappingURL=index.js.map