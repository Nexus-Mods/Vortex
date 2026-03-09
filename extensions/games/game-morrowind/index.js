//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
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
let path = require("path");
path = __toESM(path);
let vortex_api = require("vortex-api");
let react = require("react");
react = __toESM(react);
let react_bootstrap = require("react-bootstrap");
let react_i18next = require("react-i18next");
let react_redux = require("react-redux");

//#region extensions/games/game-morrowind/constants.js
var require_constants = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const MORROWIND_ID = "morrowind";
	const NATIVE_PLUGINS = [
		"Bloodmoon.esm",
		"Morrowind.esm",
		"Tribunal.esm"
	];
	module.exports = {
		MORROWIND_ID,
		NATIVE_PLUGINS
	};
}));

//#endregion
//#region extensions/games/game-morrowind/loadorder.js
var require_loadorder = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const path$3 = require("path");
	const { fs, selectors: selectors$4, util: util$4 } = require("vortex-api");
	const { default: IniParser, WinapiFormat } = require("vortex-parse-ini");
	const { MORROWIND_ID } = require_constants();
	async function validate(before, after) {
		return Promise.resolve();
	}
	async function deserializeLoadOrder(api, mods = void 0) {
		const state = api.getState();
		const discovery = selectors$4.discoveryByGame(state, MORROWIND_ID);
		if (discovery?.path === void 0) return Promise.resolve([]);
		if (mods === void 0) mods = util$4.getSafe(state, [
			"persistent",
			"mods",
			MORROWIND_ID
		], {});
		const fileMap = Object.keys(mods).reduce((accum, iter) => {
			const plugins = mods[iter]?.attributes?.plugins;
			if (mods[iter]?.attributes?.plugins !== void 0) for (const plugin of plugins) accum[plugin] = iter;
			return accum;
		}, {});
		const iniFilePath = path$3.join(discovery.path, "Morrowind.ini");
		const gameFiles = await refreshPlugins(api);
		const enabled = await readGameFiles(iniFilePath);
		return gameFiles.sort((lhs, rhs) => lhs.mtime - rhs.mtime).map((file) => ({
			id: file.name,
			enabled: enabled.includes(file.name),
			name: file.name,
			modId: fileMap[file.name]
		}));
	}
	async function refreshPlugins(api) {
		const state = api.getState();
		const discovery = selectors$4.discoveryByGame(state, MORROWIND_ID);
		if (discovery?.path === void 0) return Promise.resolve([]);
		const dataDirectory = path$3.join(discovery.path, "Data Files");
		let fileEntries = [];
		try {
			fileEntries = await fs.readdirAsync(dataDirectory);
		} catch (err) {
			return Promise.resolve([]);
		}
		const pluginEntries = [];
		for (const fileName of fileEntries) {
			if (![".esp", ".esm"].includes(path$3.extname(fileName.toLocaleLowerCase()))) continue;
			let stats;
			try {
				stats = await fs.statAsync(path$3.join(dataDirectory, fileName));
				pluginEntries.push({
					name: fileName,
					mtime: stats.mtime
				});
			} catch (err) {
				if (err.code === "ENOENT") continue;
				else return Promise.reject(err);
			}
		}
		return Promise.resolve(pluginEntries);
	}
	async function readGameFiles(iniFilePath) {
		return new IniParser(new WinapiFormat()).read(iniFilePath).then((ini) => {
			const files = ini.data["Game Files"];
			return Object.keys(files ?? {}).map((key) => files[key]);
		});
	}
	async function updatePluginOrder(iniFilePath, plugins) {
		const parser = new IniParser(new WinapiFormat());
		return parser.read(iniFilePath).then((ini) => {
			ini.data["Game Files"] = plugins.reduce((prev, plugin, idx) => {
				prev[`GameFile${idx}`] = plugin;
				return prev;
			}, {});
			return parser.write(iniFilePath, ini);
		});
	}
	async function updatePluginTimestamps(dataPath, plugins) {
		const offset = 946684800;
		const oneDay = 1440 * 60;
		return Promise.mapSeries(plugins, (fileName, idx) => {
			const mtime = offset + oneDay * idx;
			return fs.utimesAsync(path$3.join(dataPath, fileName), mtime, mtime).catch((err) => err.code === "ENOENT" ? Promise.resolve() : Promise.reject(err));
		});
	}
	async function serializeLoadOrder(api, order) {
		const state = api.getState();
		const discovery = selectors$4.discoveryByGame(state, MORROWIND_ID);
		if (discovery?.path === void 0) return Promise.reject(new util$4.ProcessCanceled("Game is not discovered"));
		const iniFilePath = path$3.join(discovery.path, "Morrowind.ini");
		const dataDirectory = path$3.join(discovery.path, "Data Files");
		const enabled = order.filter((loEntry) => loEntry.enabled === true).map((loEntry) => loEntry.id);
		try {
			await updatePluginOrder(iniFilePath, enabled);
			await updatePluginTimestamps(dataDirectory, order.map((loEntry) => loEntry.id));
		} catch (err) {
			const allowReport = !(err instanceof util$4.UserCanceled);
			api.showErrorNotification("Failed to save", err, { allowReport });
			return Promise.reject(err);
		}
		return Promise.resolve();
	}
	module.exports = {
		deserializeLoadOrder,
		serializeLoadOrder,
		readGameFiles,
		validate
	};
}));

//#endregion
//#region extensions/games/game-morrowind/collections.js
var require_collections = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const { actions: actions$2, selectors: selectors$3, util: util$3 } = require("vortex-api");
	const { MORROWIND_ID, NATIVE_PLUGINS } = require_constants();
	const { deserializeLoadOrder, serializeLoadOrder } = require_loadorder();
	async function genCollectionsData(context, gameId, includedMods, collection) {
		if (MORROWIND_ID !== gameId) return Promise.resolve([]);
		try {
			const state = context.api.getState();
			const mods = util$3.getSafe(state, [
				"persistent",
				"mods",
				gameId
			], {});
			const included = includedMods.reduce((accum, iter) => {
				if (mods[iter] !== void 0) accum[iter] = mods[iter];
				return accum;
			}, {});
			const filtered = (await deserializeLoadOrder(context.api, included)).filter((entry) => NATIVE_PLUGINS.includes(entry.id) || entry.modId !== void 0);
			return Promise.resolve({ loadOrder: filtered });
		} catch (err) {
			return Promise.reject(err);
		}
	}
	async function parseCollectionsData(context, gameId, data) {
		if (MORROWIND_ID !== gameId) return Promise.resolve();
		try {
			await serializeLoadOrder(context.api, data.loadOrder);
		} catch (err) {
			return Promise.reject(err);
		}
	}
	module.exports = {
		parseCollectionsData,
		genCollectionsData
	};
}));

//#endregion
//#region extensions/games/game-morrowind/views/MorrowindCollectionsDataView.tsx
var import_collections = require_collections();
var import_constants = require_constants();
var import_loadorder = require_loadorder();
const NAMESPACE = "game-morrowind";
var MorrowindCollectionsDataView = class extends vortex_api.ComponentEx {
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
			this.props.api.events.emit("show-main-page", "file-based-loadorder");
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
		this.renderModEntry = (loEntry, idx) => {
			const key = loEntry.id + JSON.stringify(loEntry);
			return /* @__PURE__ */ react.createElement(react_bootstrap.ListGroupItem, {
				key,
				className: ["load-order-entry", "collection-tab"].join(" ")
			}, /* @__PURE__ */ react.createElement(vortex_api.FlexLayout, { type: "row" }, /* @__PURE__ */ react.createElement("p", { className: "load-order-index" }, idx), /* @__PURE__ */ react.createElement("p", null, loEntry.name)));
		};
		this.initState({ sortedMods: [] });
	}
	componentDidMount() {
		this.updateSortedMods();
	}
	componentDidUpdate(prevProps, prevState) {
		if (JSON.stringify(this.state.sortedMods) !== JSON.stringify(this.props.loadOrder)) this.updateSortedMods();
	}
	render() {
		const { t } = this.props;
		const { sortedMods } = this.state;
		return !!sortedMods && Object.keys(sortedMods).length !== 0 ? /* @__PURE__ */ react.createElement("div", { style: { overflow: "auto" } }, /* @__PURE__ */ react.createElement("h4", null, t("Load Order")), /* @__PURE__ */ react.createElement("p", null, t("This is a snapshot of the load order information that will be exported with this collection.")), this.renderLoadOrderEditInfo(), /* @__PURE__ */ react.createElement(react_bootstrap.ListGroup, { id: "collections-load-order-list" }, sortedMods.map((entry, idx) => this.renderModEntry(entry, idx)))) : this.renderPlaceholder();
	}
	updateSortedMods() {
		const includedModIds = (this.props.collection?.rules || []).map((rule) => rule.reference.id);
		const mods = Object.keys(this.props.mods).reduce((accum, iter) => {
			if (includedModIds.includes(iter)) accum[iter] = this.props.mods[iter];
			return accum;
		}, {});
		(0, import_loadorder.deserializeLoadOrder)(this.props.api, mods).then((lo) => {
			const filtered = lo.filter((entry) => import_constants.NATIVE_PLUGINS.includes(entry.id) || entry.modId !== void 0);
			this.nextState.sortedMods = filtered;
		});
	}
};
const empty = [];
function mapStateToProps(state, ownProps) {
	const profile = vortex_api.selectors.activeProfile(state) || void 0;
	let loadOrder = [];
	if (!!profile?.gameId) loadOrder = vortex_api.util.getSafe(state, [
		"persistent",
		"loadOrder",
		profile.id
	], empty);
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
function mapDispatchToProps(dispatch) {
	return {};
}
var MorrowindCollectionsDataView_default = (0, react_i18next.withTranslation)(["common", NAMESPACE])((0, react_redux.connect)(mapStateToProps, mapDispatchToProps)(MorrowindCollectionsDataView));

//#endregion
//#region extensions/games/game-morrowind/migrations.js
var require_migrations = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const path$2 = require("path");
	const semver = require("semver");
	const { actions: actions$1, selectors: selectors$1, util: util$1 } = require("vortex-api");
	const { MORROWIND_ID } = require_constants();
	const walk$1 = require("turbowalk").default;
	async function migrate103(api, oldVersion) {
		if (semver.gte(oldVersion, "1.0.3")) return Promise.resolve();
		const state = api.getState();
		const installPath = selectors$1.installPathForGame(state, MORROWIND_ID);
		const mods = util$1.getSafe(state, [
			"persistent",
			"mods",
			MORROWIND_ID
		], {});
		if (installPath === void 0 || Object.keys(mods).length === 0) return Promise.resolve();
		const batched = [];
		for (const mod of Object.values(mods)) {
			if (mod?.installationPath === void 0) continue;
			const modPath = path$2.join(installPath, mod.installationPath);
			const plugins = [];
			await walk$1(modPath, (entries) => {
				for (let entry of entries) if ([".esp", ".esm"].includes(path$2.extname(entry.filePath.toLowerCase()))) plugins.push(path$2.basename(entry.filePath));
			}, {
				recurse: true,
				skipLinks: true,
				skipInaccessible: true
			});
			if (plugins.length > 0) batched.push(actions$1.setModAttribute(MORROWIND_ID, mod.id, "plugins", plugins));
		}
		if (batched.length > 0 && util$1.batchDispatch !== void 0) util$1.batchDispatch(api.store, batched);
		else for (const action of batched) api.store.dispatch(action);
		return Promise.resolve();
	}
	module.exports = { migrate103 };
}));

//#endregion
//#region extensions/games/game-morrowind/index.ts
var import_migrations = require_migrations();
const walk = require("turbowalk").default;
const STEAMAPP_ID = "22320";
const GOG_ID = "1435828767";
const MS_ID = "BethesdaSoftworks.TESMorrowind-PC";
const GAME_ID = import_constants.MORROWIND_ID;
const localeFoldersXbox = {
	en: "Morrowind GOTY English",
	fr: "Morrowind GOTY French",
	de: "Morrowind GOTY German"
};
const gameStoreIds = {
	steam: [{
		id: STEAMAPP_ID,
		prefer: 0
	}],
	xbox: [{ id: MS_ID }],
	gog: [{ id: GOG_ID }],
	registry: [{ id: "HKEY_LOCAL_MACHINE:Software\\Wow6432Node\\Bethesda Softworks\\Morrowind:Installed Path" }]
};
const tools = [{
	id: "tes3edit",
	name: "TES3Edit",
	executable: () => "TES3Edit.exe",
	requiredFiles: []
}, {
	id: "mw-construction-set",
	name: "Construction Set",
	logo: "constructionset.png",
	executable: () => "TES Construction Set.exe",
	requiredFiles: ["TES Construction Set.exe"],
	relative: true,
	exclusive: true
}];
async function findGame() {
	const storeGames = await vortex_api.util.GameStoreHelper.find(gameStoreIds).catch(() => []);
	if (!storeGames.length) return;
	if (storeGames.length > 1) (0, vortex_api.log)("debug", "Mutliple copies of Oblivion found", storeGames.map((s) => s.gameStoreId));
	const selectedGame = storeGames[0];
	if (["epic", "xbox"].includes(selectedGame.gameStoreId)) {
		(0, vortex_api.log)("debug", "Defaulting to the English game version", {
			store: selectedGame.gameStoreId,
			folder: localeFoldersXbox["en"]
		});
		selectedGame.gamePath = path.default.join(selectedGame.gamePath, localeFoldersXbox["en"]);
	}
	return selectedGame;
}
function prepareForModding(api, discovery) {
	const gameName = vortex_api.util.getGame(GAME_ID)?.name || "This game";
	if (discovery.store && ["epic", "xbox"].includes(discovery.store)) {
		const storeName = discovery.store === "epic" ? "Epic Games" : "Xbox Game Pass";
		api.sendNotification({
			id: `${GAME_ID}-locale-message`,
			type: "info",
			title: "Multiple Languages Available",
			message: "Default: English",
			allowSuppress: true,
			actions: [{
				title: "More",
				action: (dismiss) => {
					dismiss();
					api.showDialog("info", "Mutliple Languages Available", {
						bbcode: "{{gameName}} has multiple language options when downloaded from {{storeName}}. [br][/br][br][/br]Vortex has selected the English variant by default. [br][/br][br][/br]If you would prefer to manage a different language you can change the path to the game using the \"Manually Set Location\" option in the games tab.",
						parameters: {
							gameName,
							storeName
						}
					}, [{
						label: "Close",
						action: () => api.suppressNotification(`${GAME_ID}-locale-message`)
					}]);
				}
			}]
		});
	}
	return Promise.resolve();
}
function CollectionDataWrap(api, props) {
	return react.createElement(MorrowindCollectionsDataView_default, {
		...props,
		api
	});
}
function main(context) {
	context.registerGame({
		id: import_constants.MORROWIND_ID,
		name: "Morrowind",
		mergeMods: true,
		queryPath: vortex_api.util.toBlue(findGame),
		supportedTools: tools,
		setup: vortex_api.util.toBlue((discovery) => prepareForModding(context.api, discovery)),
		queryModPath: () => "Data Files",
		logo: "gameart.jpg",
		executable: () => "morrowind.exe",
		requiredFiles: ["morrowind.exe"],
		environment: { SteamAPPId: STEAMAPP_ID },
		details: {
			steamAppId: parseInt(STEAMAPP_ID, 10),
			gogAppId: GOG_ID
		}
	});
	context.registerLoadOrder({
		gameId: import_constants.MORROWIND_ID,
		deserializeLoadOrder: () => (0, import_loadorder.deserializeLoadOrder)(context.api),
		serializeLoadOrder: (loadOrder) => (0, import_loadorder.serializeLoadOrder)(context.api, loadOrder),
		validate: import_loadorder.validate,
		noCollectionGeneration: true,
		toggleableEntries: true,
		usageInstructions: "Drag your plugins as needed - the game will load load them from top to bottom."
	});
	context.optional.registerCollectionFeature("morrowind_collection_data", (gameId, includedMods, collection) => (0, import_collections.genCollectionsData)(context, gameId, includedMods, collection), (gameId, collection) => (0, import_collections.parseCollectionsData)(context, gameId, collection), () => Promise.resolve(), (t) => t("Load Order"), (state, gameId) => gameId === import_constants.MORROWIND_ID, (props) => CollectionDataWrap(context.api, props));
	context.registerMigration((old) => (0, import_migrations.migrate103)(context.api, old));
	context.once(() => {
		context.api.events.on("did-install-mod", async (gameId, archiveId, modId) => {
			if (gameId !== import_constants.MORROWIND_ID) return;
			const state = context.api.getState();
			const installPath = vortex_api.selectors.installPathForGame(state, import_constants.MORROWIND_ID);
			const mod = vortex_api.util.getSafe(state, [
				"persistent",
				"mods",
				import_constants.MORROWIND_ID,
				modId
			], void 0);
			if (installPath === void 0 || mod === void 0) return;
			const modPath = path.default.join(installPath, mod.installationPath);
			const plugins = [];
			try {
				await walk(modPath, (entries) => {
					for (let entry of entries) if ([".esp", ".esm"].includes(path.default.extname(entry.filePath.toLowerCase()))) plugins.push(path.default.basename(entry.filePath));
				}, {
					recurse: true,
					skipLinks: true,
					skipInaccessible: true
				});
			} catch (err) {
				context.api.showErrorNotification("Failed to read list of plugins", err, { allowReport: false });
			}
			if (plugins.length > 0) context.api.store.dispatch(vortex_api.actions.setModAttribute(import_constants.MORROWIND_ID, mod.id, "plugins", plugins));
		});
	});
	return true;
}
module.exports = { default: main };

//#endregion
//# sourceMappingURL=index.js.map