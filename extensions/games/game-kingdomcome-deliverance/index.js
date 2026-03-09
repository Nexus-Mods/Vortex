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
let react = require("react");
react = __toESM(react);
let react_bootstrap = require("react-bootstrap");
react_bootstrap = __toESM(react_bootstrap);
let react_redux = require("react-redux");
let path = require("path");
path = __toESM(path);
let vortex_api = require("vortex-api");
let react_i18next = require("react-i18next");

//#region extensions/games/game-kingdomcome-deliverance/statics.ts
const GAME_ID = "kingdomcomedeliverance";
const MODS_ORDER_FILENAME = "mod_order.txt";

//#endregion
//#region extensions/games/game-kingdomcome-deliverance/util.ts
function transformId(modId) {
	return modId.replace(/[ -.]/g, "");
}

//#endregion
//#region extensions/games/game-kingdomcome-deliverance/collections/loadOrder.ts
async function exportLoadOrder(state, modIds) {
	const profileId = vortex_api.selectors.lastActiveProfileForGame(state, GAME_ID);
	if (profileId === void 0) return Promise.reject(new vortex_api.util.ProcessCanceled("Invalid profile id"));
	const loadOrder = vortex_api.util.getSafe(state, [
		"persistent",
		"loadOrder",
		profileId
	], []);
	if (!loadOrder) return Promise.resolve(void 0);
	const filteredLO = loadOrder.filter((lo) => modIds.some((id) => transformId(id) === lo));
	return Promise.resolve(filteredLO);
}
async function importLoadOrder(api, collection) {
	const state = api.getState();
	const profileId = vortex_api.selectors.lastActiveProfileForGame(state, GAME_ID);
	if (profileId === void 0) return Promise.reject(new vortex_api.util.ProcessCanceled(`Invalid profile id ${profileId}`));
	api.store.dispatch(vortex_api.actions.setLoadOrder(profileId, collection.loadOrder));
	return Promise.resolve(void 0);
}

//#endregion
//#region extensions/games/game-kingdomcome-deliverance/collections/collections.ts
async function genCollectionsData(context, gameId, includedMods) {
	const api = context.api;
	try {
		const collectionData = { loadOrder: await exportLoadOrder(api.getState(), includedMods) };
		return Promise.resolve(collectionData);
	} catch (err) {
		return Promise.reject(err);
	}
}
async function parseCollectionsData(context, gameId, collection) {
	const api = context.api;
	const state = api.getState();
	const profileId = vortex_api.selectors.lastActiveProfileForGame(state, gameId);
	if (vortex_api.selectors.profileById(state, profileId)?.gameId !== gameId) return Promise.reject(new vortex_api.util.ProcessCanceled("Last active profile is missing"));
	try {
		await importLoadOrder(api, collection);
	} catch (err) {
		return Promise.reject(err);
	}
}

//#endregion
//#region extensions/games/game-kingdomcome-deliverance/collections/util.ts
function isValidMod(mod) {
	return mod !== void 0 && mod.type !== "collection";
}
function isModInCollection(collectionMod, mod) {
	if (collectionMod.rules === void 0) return false;
	return collectionMod.rules.find((rule) => vortex_api.util.testModReference(mod, rule.reference)) !== void 0;
}
function genCollectionLoadOrder(loadOrder, mods, collection) {
	return (loadOrder || []).filter((loId) => {
		const modId = getModId(mods, loId);
		return collection !== void 0 ? isValidMod(mods[modId]) && isModInCollection(collection, mods[modId]) : isValidMod(mods[modId]);
	});
}
function getModId(mods, loId) {
	return Object.keys(mods).find((modId) => transformId(modId) === loId);
}

//#endregion
//#region extensions/games/game-kingdomcome-deliverance/collections/CollectionsDataView.tsx
const NAMESPACE = "generic-load-order-extension";
var CollectionsDataView = class extends vortex_api.ComponentEx {
	static getDerivedStateFromProps(newProps, state) {
		const { loadOrder, mods, collection } = newProps;
		const sortedMods = genCollectionLoadOrder(loadOrder, mods, collection);
		return sortedMods !== state.sortedMods ? { sortedMods } : null;
	}
	constructor(props) {
		super(props);
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
		this.renderModEntry = (loId) => {
			const { mods } = this.props;
			const { sortedMods } = this.state;
			this.state.sortedMods[loId];
			const idx = this.state.sortedMods.indexOf(loId);
			const key = `${idx}-${loId}`;
			const modId = getModId(mods, loId);
			const name = vortex_api.util.renderModName(this.props.mods[modId]) || modId;
			return /* @__PURE__ */ react.createElement(react_bootstrap.ListGroupItem, {
				key,
				className: ["load-order-entry", "collection-tab"].join(" ")
			}, /* @__PURE__ */ react.createElement(vortex_api.FlexLayout, { type: "row" }, /* @__PURE__ */ react.createElement("p", { className: "load-order-index" }, idx), /* @__PURE__ */ react.createElement("p", null, name)));
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
		return !!sortedMods && Object.keys(sortedMods).length !== 0 ? /* @__PURE__ */ react.createElement("div", { style: { overflow: "auto" } }, /* @__PURE__ */ react.createElement("h4", null, t("Load Order")), /* @__PURE__ */ react.createElement("p", null, t("Below is a preview of the load order for the mods that are included in the current collection. If you wish to modify the load please do so by opening the Load Order page; any changes made there will be reflected in this collection.")), /* @__PURE__ */ react.createElement(react_bootstrap.ListGroup, { id: "collections-load-order-list" }, sortedMods.map(this.renderModEntry))) : this.renderPlaceholder();
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
function mapDispatchToProps$1(dispatch) {
	return {};
}
var CollectionsDataView_default = (0, react_i18next.withTranslation)(["common", NAMESPACE])((0, react_redux.connect)(mapStateToProps$1, mapDispatchToProps$1)(CollectionsDataView));

//#endregion
//#region extensions/games/game-kingdomcome-deliverance/index.ts
const I18N_NAMESPACE = `game-${GAME_ID}`;
const STEAM_APPID = "379430";
const EPIC_APPID = "Eel";
const XBOX_APPID = "DeepSilver.KingdomComeDeliverance";
const XBOXEXECNAME = "App";
const _MODS_STATE = {
	enabled: [],
	disabled: [],
	display: []
};
function findGame() {
	return vortex_api.util.GameStoreHelper.findByAppId([
		STEAM_APPID,
		XBOX_APPID,
		EPIC_APPID
	]).then((game) => game.gamePath);
}
async function requiresLauncher(gamePath, store) {
	if (store === "xbox") return Promise.resolve({
		launcher: "xbox",
		addInfo: {
			appId: XBOX_APPID,
			parameters: [{ appExecName: XBOXEXECNAME }]
		}
	});
	if (store === "epic") return Promise.resolve({
		launcher: "epic",
		addInfo: { appId: EPIC_APPID }
	});
	return Promise.resolve(void 0);
}
function getExecutable(discoveredPath) {
	const steamPath = path.default.join("Bin", "Win64", "KingdomCome.exe");
	const epicPath = path.default.join("Bin", "Win64MasterMasterEpicPGO", "KingdomCome.exe");
	const xboxPath = path.default.join("gamelaunchhelper.exe");
	const isCorrectExec = (exec) => {
		try {
			vortex_api.fs.statSync(path.default.join(discoveredPath, exec));
			return true;
		} catch (err) {
			return false;
		}
	};
	if (isCorrectExec(epicPath)) return epicPath;
	if (isCorrectExec(xboxPath)) return xboxPath;
	if (isCorrectExec(steamPath)) return steamPath;
	return steamPath;
}
function prepareForModding(context, discovery) {
	const state = context.api.store.getState();
	const profile = vortex_api.selectors.activeProfile(state);
	return vortex_api.fs.ensureDirWritableAsync(path.default.join(discovery.path, "Mods"), () => bluebird.default.resolve()).then(() => getCurrentOrder(path.default.join(discovery.path, modsPath(), MODS_ORDER_FILENAME))).catch((err) => err.code === "ENOENT" ? Promise.resolve([]) : Promise.reject(err)).then((data) => setNewOrder({
		context,
		profile
	}, Array.isArray(data) ? data : data.split("\n")));
}
function getCurrentOrder(modOrderFilepath) {
	return vortex_api.fs.readFileAsync(modOrderFilepath, { encoding: "utf8" });
}
function walkAsync(dir) {
	let entries = [];
	return vortex_api.fs.readdirAsync(dir).then((files) => {
		return bluebird.default.each(files, (file) => {
			const fullPath = path.default.join(dir, file);
			return vortex_api.fs.statAsync(fullPath).then((stats) => {
				if (stats.isDirectory()) return walkAsync(fullPath).then((nestedFiles) => {
					entries = entries.concat(nestedFiles);
					return Promise.resolve();
				});
				else {
					entries.push(fullPath);
					return Promise.resolve();
				}
			});
		});
	}).then(() => Promise.resolve(entries)).catch((err) => {
		(0, vortex_api.log)("error", "Unable to read mod directory", err);
		return Promise.resolve(entries);
	});
}
function readModsFolder(modsFolder, api) {
	const extL = (input) => path.default.extname(input).toLowerCase();
	const isValidMod = (modFile) => [
		".pak",
		".cfg",
		".manifest"
	].indexOf(extL(modFile)) !== -1;
	return vortex_api.fs.readdirAsync(modsFolder).then((entries) => bluebird.default.reduce(entries, (accum, current) => {
		const currentPath = path.default.join(modsFolder, current);
		return vortex_api.fs.readdirAsync(currentPath).then((modFiles) => {
			if (modFiles.some(isValidMod) === true) accum.push(current);
			return Promise.resolve(accum);
		}).catch((err) => Promise.resolve(accum));
	}, [])).catch((err) => {
		const allowReport = [
			"ENOENT",
			"EPERM",
			"EACCESS"
		].indexOf(err.code) === -1;
		api.showErrorNotification("failed to read kingdom come mods directory", err.message, { allowReport });
		return Promise.resolve([]);
	});
}
function listHasMod(modId, list) {
	return !!list ? list.map((mod) => transformId(mod).toLowerCase()).includes(modId.toLowerCase()) : false;
}
function getManuallyAddedMods(disabledMods, enabledMods, modOrderFilepath, api) {
	return readModsFolder(path.default.dirname(modOrderFilepath), api).then((deployedMods) => getCurrentOrder(modOrderFilepath).catch((err) => err.code === "ENOENT" ? Promise.resolve("") : Promise.reject(err)).then((data) => {
		const manuallyAdded = data.split("\n").filter((entry) => !listHasMod(entry, enabledMods) && !listHasMod(entry, disabledMods) && listHasMod(entry, deployedMods));
		return Promise.resolve(manuallyAdded);
	}));
}
function refreshModList(context, discoveryPath) {
	const state = context.api.store.getState();
	const profile = vortex_api.selectors.activeProfile(state);
	const installationPath = vortex_api.selectors.installPathForGame(state, GAME_ID);
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID
	], []);
	const modKeys = Object.keys(mods);
	const modState = vortex_api.util.getSafe(profile, ["modState"], {});
	const enabled = modKeys.filter((mod) => !!modState[mod] && modState[mod].enabled);
	const disabled = modKeys.filter((dis) => !enabled.includes(dis));
	const extL = (input) => path.default.extname(input).toLowerCase();
	return bluebird.default.reduce(enabled, (accum, mod) => {
		if (mods[mod]?.installationPath === void 0) return accum;
		return walkAsync(path.default.join(installationPath, mods[mod].installationPath)).then((entries) => entries.find((fileName) => [
			".pak",
			".cfg",
			".manifest"
		].includes(extL(fileName))) !== void 0 ? accum.concat(mod) : accum);
	}, []).then((managedMods) => {
		return getManuallyAddedMods(disabled, enabled, path.default.join(discoveryPath, modsPath(), MODS_ORDER_FILENAME), context.api).then((manuallyAdded) => {
			_MODS_STATE.enabled = [].concat(managedMods.map((mod) => transformId(mod)), manuallyAdded);
			_MODS_STATE.disabled = disabled;
			_MODS_STATE.display = _MODS_STATE.enabled;
			return Promise.resolve();
		});
	});
}
function LoadOrderBase(props) {
	const getMod = (item) => {
		const found = Object.keys(props.mods).find((key) => transformId(key) === item);
		return found !== void 0 ? props.mods[found] : { attributes: { name: item } };
	};
	class ItemRenderer extends react.Component {
		render() {
			if (props.mods === void 0) return null;
			const item = this.props.item;
			const mod = getMod(item);
			return react.createElement(react_bootstrap.ListGroupItem, { style: {
				backgroundColor: "var(--brand-bg, black)",
				borderBottom: "2px solid var(--border-color, white)"
			} }, react.createElement("div", { style: { fontSize: "1.1em" } }, react.createElement("img", {
				src: !!mod.attributes.pictureUrl ? mod.attributes.pictureUrl : `${__dirname}/gameart.jpg`,
				className: "mod-picture",
				width: "75px",
				height: "45px",
				style: {
					margin: "5px 10px 5px 5px",
					border: "1px solid var(--brand-secondary,#D78F46)"
				}
			}), vortex_api.util.renderModName(mod)));
		}
	}
	return react.createElement(vortex_api.MainPage, {}, react.createElement(vortex_api.MainPage.Body, {}, react.createElement(react_bootstrap.Panel, { id: "kcd-loadorder-panel" }, react.createElement(react_bootstrap.Panel.Body, {}, react.createElement(vortex_api.FlexLayout, { type: "row" }, react.createElement(vortex_api.FlexLayout.Flex, {}, react.createElement(vortex_api.DraggableList, {
		id: "kcd-loadorder",
		itemTypeId: "kcd-loadorder-item",
		items: _MODS_STATE.display,
		itemRenderer: ItemRenderer,
		style: {
			height: "100%",
			overflow: "auto",
			borderWidth: "var(--border-width, 1px)",
			borderStyle: "solid",
			borderColor: "var(--border-color, white)"
		},
		apply: (ordered) => {
			props.onSetDeploymentNecessary(GAME_ID, true);
			return setNewOrder(props, ordered);
		}
	})), react.createElement(vortex_api.FlexLayout.Flex, {}, react.createElement("div", { style: { padding: "var(--half-gutter, 15px)" } }, react.createElement("h2", {}, props.t("Changing your load order", { ns: I18N_NAMESPACE })), react.createElement("p", {}, props.t("Drag and drop the mods on the left to reorder them. Kingdom Come: Deliverance uses a mod_order.txt file to define the order in which mods are loaded, Vortex will write the folder names of the displayed mods in the order you have set. Mods placed at the bottom of the load order will have priority over those above them.", { ns: I18N_NAMESPACE })), react.createElement("p", {}, props.t("Note: Vortex will detect manually added mods as long as these have been added to the mod_order.txt file. Manually added mods are not managed by Vortex - to remove these, you will have to manually erase the entry from the mod_order.txt file.", { ns: I18N_NAMESPACE })))))))));
}
function modsPath() {
	return "Mods";
}
function setNewOrder(props, ordered) {
	const { context, profile, onSetOrder } = props;
	if (profile?.id === void 0) {
		(0, vortex_api.log)("error", "failed to set new load order", "undefined profile");
		return;
	}
	const filtered = ordered.filter((entry) => !!entry);
	_MODS_STATE.display = filtered;
	return !!onSetOrder ? onSetOrder(profile.id, filtered) : context.api.store.dispatch(vortex_api.actions.setLoadOrder(profile.id, filtered));
}
function writeOrderFile(filePath, modList) {
	return vortex_api.fs.removeAsync(filePath).catch((err) => err.code === "ENOENT" ? Promise.resolve() : Promise.reject(err)).then(() => vortex_api.fs.ensureFileAsync(filePath)).then(() => vortex_api.fs.writeFileAsync(filePath, modList.join("\n"), { encoding: "utf8" }));
}
function main(context) {
	context.registerGame({
		id: GAME_ID,
		name: "Kingdom Come:	Deliverance",
		mergeMods: (mod) => transformId(mod.id),
		queryPath: findGame,
		queryModPath: modsPath,
		logo: "gameart.jpg",
		executable: getExecutable,
		requiredFiles: ["Data/Levels/rataje/level.pak"],
		setup: (discovery) => prepareForModding(context, discovery),
		requiresLauncher,
		environment: {
			SteamAPPId: STEAM_APPID,
			XboxAPPId: XBOX_APPID,
			EpicAPPId: EPIC_APPID
		},
		details: {
			steamAppId: +STEAM_APPID,
			xboxAppId: XBOX_APPID,
			epicAppId: EPIC_APPID
		}
	});
	context.registerMainPage("sort-none", "Load Order", LoadOrder, {
		id: "kcd-load-order",
		hotkey: "E",
		group: "per-game",
		visible: () => vortex_api.selectors.activeGameId(context.api.store.getState()) === GAME_ID,
		props: () => ({ t: context.api.translate })
	});
	context.optional.registerCollectionFeature("kcd_collection_data", (gameId, includedMods) => genCollectionsData(context, gameId, includedMods), (gameId, collection) => parseCollectionsData(context, gameId, collection), () => Promise.resolve(), (t) => t("Kingdom Come: Deliverance Data"), (state, gameId) => gameId === GAME_ID, CollectionsDataView_default);
	context.once(() => {
		context.api.events.on("mod-enabled", (profileId, modId) => {
			const state = context.api.store.getState();
			const discovery = vortex_api.util.getSafe(state, [
				"settings",
				"gameMode",
				"discovered",
				GAME_ID
			], void 0);
			if (discovery?.path === void 0) return;
			const profile = vortex_api.util.getSafe(state, [
				"persistent",
				"profiles",
				profileId
			], void 0);
			if (!!profile && profile.gameId === GAME_ID && _MODS_STATE.display.indexOf(modId) === -1) refreshModList(context, discovery.path);
		});
		context.api.events.on("purge-mods", () => {
			const state = context.api.store.getState();
			const profile = vortex_api.selectors.activeProfile(state);
			if (profile === void 0 || profile.gameId !== GAME_ID) return;
			const discovery = vortex_api.util.getSafe(state, [
				"settings",
				"gameMode",
				"discovered",
				GAME_ID
			], void 0);
			if (discovery === void 0 || discovery.path === void 0) {
				(0, vortex_api.log)("error", "kingdomcomedeliverance was not discovered");
				return;
			}
			const modsOrderFilePath = path.default.join(discovery.path, modsPath(), MODS_ORDER_FILENAME);
			const managedMods = vortex_api.util.getSafe(state, [
				"persistent",
				"mods",
				GAME_ID
			], {});
			const modKeys = Object.keys(managedMods);
			const modState = vortex_api.util.getSafe(profile, ["modState"], {});
			const enabled = modKeys.filter((mod) => !!modState[mod] && modState[mod].enabled);
			getManuallyAddedMods(modKeys.filter((dis) => !enabled.includes(dis)), enabled, modsOrderFilePath, context.api).then((manuallyAdded) => {
				writeOrderFile(modsOrderFilePath, manuallyAdded).then(() => setNewOrder({
					context,
					profile
				}, manuallyAdded)).catch((err) => {
					const allowReport = !(err instanceof vortex_api.util.UserCanceled) && err["code"] !== "EPERM";
					context.api.showErrorNotification("Failed to write to load order file", err, { allowReport });
				});
			}).catch((err) => {
				const userCanceled = err instanceof vortex_api.util.UserCanceled;
				context.api.showErrorNotification("Failed to re-instate manually added mods", err, { allowReport: !userCanceled });
			});
		});
		context.api.onAsync("did-deploy", (profileId, deployment) => {
			const state = context.api.getState();
			const profile = vortex_api.selectors.profileById(state, profileId);
			if (profile === void 0 || profile.gameId !== GAME_ID) {
				if (profile === void 0) (0, vortex_api.log)("error", "profile does not exist", profileId);
				return Promise.resolve();
			}
			const loadOrder = state.persistent["loadOrder"]?.[profileId] ?? [];
			const discovery = vortex_api.util.getSafe(state, [
				"settings",
				"gameMode",
				"discovered",
				profile.gameId
			], void 0);
			if (discovery === void 0 || discovery.path === void 0) {
				(0, vortex_api.log)("error", "kingdomcomedeliverance was not discovered");
				return Promise.resolve();
			}
			const modsFolder = path.default.join(discovery.path, modsPath());
			const modOrderFile = path.default.join(modsFolder, MODS_ORDER_FILENAME);
			return refreshModList(context, discovery.path).then(() => {
				let missing = loadOrder.filter((mod) => !listHasMod(transformId(mod), _MODS_STATE.enabled) && !listHasMod(transformId(mod), _MODS_STATE.disabled) && listHasMod(transformId(mod), _MODS_STATE.display)).map((mod) => transformId(mod)) || [];
				missing = [...new Set(missing)];
				const transformed = [..._MODS_STATE.enabled, ...missing];
				const loValue = (input) => {
					const idx = loadOrder.indexOf(input);
					return idx !== -1 ? idx : loadOrder.length;
				};
				let sorted = transformed.length > 1 ? transformed.sort((lhs, rhs) => loValue(lhs) - loValue(rhs)) : transformed;
				setNewOrder({
					context,
					profile
				}, sorted);
				return writeOrderFile(modOrderFile, transformed).catch((err) => {
					const userCanceled = err instanceof vortex_api.util.UserCanceled;
					context.api.showErrorNotification("Failed to write to load order file", err, { allowReport: !userCanceled });
				});
			});
		});
	});
	return true;
}
function mapStateToProps(state) {
	const profile = vortex_api.selectors.activeProfile(state);
	const profileId = profile?.id || "";
	const gameId = profile?.gameId || "";
	return {
		profile,
		modState: vortex_api.util.getSafe(profile, ["modState"], {}),
		mods: vortex_api.util.getSafe(state, [
			"persistent",
			"mods",
			gameId
		], []),
		order: vortex_api.util.getSafe(state, [
			"persistent",
			"loadOrder",
			profileId
		], [])
	};
}
function mapDispatchToProps(dispatch) {
	return {
		onSetDeploymentNecessary: (gameId, necessary) => dispatch(vortex_api.actions.setDeploymentNecessary(gameId, necessary)),
		onSetOrder: (profileId, ordered) => dispatch(vortex_api.actions.setLoadOrder(profileId, ordered))
	};
}
const LoadOrder = (0, react_redux.connect)(mapStateToProps, mapDispatchToProps)(LoadOrderBase);
module.exports = { default: main };

//#endregion
//# sourceMappingURL=index.js.map