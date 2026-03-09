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
let path = require("path");
path = __toESM(path);
let vortex_api = require("vortex-api");

//#region extensions/games/game-falloutnv/index.ts
const localeFoldersXbox = {
	en: "Fallout New Vegas English",
	fr: "Fallout New Vegas French",
	de: "Fallout New Vegas German",
	it: "Fallout New Vegas Italian",
	es: "Fallout New Vegas Spanish"
};
const GAME_ID = "falloutnv";
const NEXUS_DOMAIN_NAME = "newvegas";
const STEAMAPP_ID = "22380";
const STEAMAPP_ID2 = "22490";
const GOG_ID = "1454587428";
const MS_ID = "BethesdaSoftworks.FalloutNewVegas";
const EPIC_ID = "5daeb974a22a435988892319b3a4f476";
const PATCH_4GB_EXECUTABLES = [
	"FNVpatch.exe",
	"FalloutNVpatch.exe",
	"Patcher.exe"
];
let selectedLanguage = void 0;
let multipleLanguages = false;
const gameStoreIds = {
	steam: [
		{
			id: STEAMAPP_ID,
			prefer: 0
		},
		{ id: STEAMAPP_ID2 },
		{ name: "Fallout: New Vegas.*" }
	],
	xbox: [{ id: MS_ID }],
	gog: [{ id: GOG_ID }],
	epic: [{ id: EPIC_ID }],
	registry: [{ id: "HKEY_LOCAL_MACHINE:Software\\Wow6432Node\\Bethesda Softworks\\falloutnv:Installed Path" }]
};
async function findGame() {
	const storeGames = await vortex_api.util.GameStoreHelper.find(gameStoreIds).catch(() => []);
	if (!storeGames.length) return;
	if (storeGames.length > 1) (0, vortex_api.log)("debug", "Mutliple copies of New Vegas found", storeGames.map((s) => s.gameStoreId));
	const selectedGame = storeGames[0];
	if (["epic", "xbox"].includes(selectedGame.gameStoreId)) try {
		const folders = await vortex_api.fs.readdirAsync(selectedGame.gamePath).filter((p) => !path.default.extname(p) && !p.startsWith("."));
		const availableLocales = Object.keys(localeFoldersXbox).reduce((accum, cur) => {
			const localeFolderName = localeFoldersXbox[cur];
			if (folders.includes(localeFolderName)) accum.push(cur);
			return accum;
		}, []);
		if (!availableLocales.length) {
			(0, vortex_api.log)("warn", "Could not find any recognised locale folders for New Vegas", {
				folders,
				path: selectedGame.gamePath
			});
			selectedGame.gamePath = path.default.join(selectedGame.gamePath, folders[0]);
			selectedLanguage = folders[0].toUpperCase().replace("Fallout New Vegas", "").trim();
		} else if (availableLocales.length === 1) selectedGame.gamePath = path.default.join(selectedGame.gamePath, localeFoldersXbox[availableLocales[0]]);
		else {
			const selectedLocale = availableLocales.includes("en") ? "en" : availableLocales[0];
			selectedLanguage = selectedLocale.toUpperCase();
			multipleLanguages = true;
			(0, vortex_api.log)("debug", `Defaulting to the ${selectedLocale} game version`, {
				store: selectedGame.gameStoreId,
				folder: localeFoldersXbox[selectedLocale]
			});
			selectedGame.gamePath = path.default.join(selectedGame.gamePath, localeFoldersXbox[selectedLocale]);
		}
	} catch (err) {
		(0, vortex_api.log)("warn", "Could not check for Fallout NV locale paths", err);
	}
	return selectedGame;
}
const tools = [
	{
		id: "FNVEdit",
		name: "FNVEdit",
		logo: "fo3edit.png",
		executable: () => "FNVEdit.exe",
		requiredFiles: ["FNVEdit.exe"]
	},
	{
		id: "WryeBash",
		name: "Wrye Bash",
		logo: "wrye.png",
		executable: () => "Wrye Bash.exe",
		requiredFiles: ["Wrye Bash.exe"]
	},
	{
		id: "nvse",
		name: "New Vegas Script Extender",
		logo: "nvse.png",
		shortName: "NVSE",
		executable: () => "nvse_loader.exe",
		requiredFiles: ["nvse_loader.exe", "FalloutNV.exe"],
		relative: true,
		exclusive: true,
		defaultPrimary: true
	}
];
function prepareForModding(api, discovery) {
	const gameName = vortex_api.util.getGame(GAME_ID)?.name || "This game";
	if (discovery.store && ["epic", "xbox"].includes(discovery.store)) {
		const storeName = discovery.store === "epic" ? "Epic Games" : "Xbox Game Pass";
		if (multipleLanguages) api.sendNotification({
			id: `${GAME_ID}-locale-message`,
			type: "info",
			title: "Multiple Languages Available",
			message: `Default: ${selectedLanguage}`,
			allowSuppress: true,
			actions: [{
				title: "More",
				action: (dismiss) => {
					dismiss();
					api.showDialog("info", "Mutliple Languages Available", {
						bbcode: "{{gameName}} has multiple language options when downloaded from {{storeName}}. [br][/br][br][/br]Vortex has selected the {{selectedLanguage}} variant by default. [br][/br][br][/br]If you would prefer to manage a different language you can change the path to the game using the \"Manually Set Location\" option in the games tab.",
						parameters: {
							gameName,
							storeName,
							selectedLanguage
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
async function requiresLauncher(gamePath, store) {
	const xboxSettings = {
		launcher: "xbox",
		addInfo: {
			appId: MS_ID,
			parameters: [{ appExecName: "Game" }]
		}
	};
	const epicSettings = {
		launcher: "epic",
		addInfo: { appId: EPIC_ID }
	};
	if (store !== void 0) {
		if (store === "xbox") return xboxSettings;
		if (store === "epic") return epicSettings;
		else return void 0;
	}
	try {
		const game = await vortex_api.util.GameStoreHelper.findByAppId([MS_ID], "xbox");
		const normalizeFunc = await vortex_api.util.getNormalizeFunc(gamePath);
		if (normalizeFunc(game.gamePath) === normalizeFunc(gamePath)) return xboxSettings;
		else return void 0;
	} catch (err) {
		return;
	}
}
function testInstaller4GBPatch(api) {
	return (files, gameId, archivePath, details) => {
		const state = api.getState();
		if (vortex_api.selectors.activeGameId(state) !== GAME_ID || details?.hasXmlConfigXML || details?.hasCSScripts) return Promise.resolve({
			supported: false,
			requiredFiles: []
		});
		const lowered = files.map((f) => f.toLowerCase());
		const hasPatchExe = PATCH_4GB_EXECUTABLES.some((execName) => lowered.includes(execName.toLowerCase()));
		return Promise.resolve({
			supported: hasPatchExe,
			requiredFiles: []
		});
	};
}
function applyInstaller4GBPatch(api) {
	return async (files, destinationPath, gameId, progressDelegate, choices, unattended, archivePath, details) => {
		const instructions = files.map((f) => ({
			type: "copy",
			source: f,
			destination: f
		}));
		const attrib = {
			type: "attribute",
			key: "is4GBPatcher",
			value: true
		};
		const modTypeInstr = {
			type: "setmodtype",
			value: "dinput"
		};
		instructions.push(modTypeInstr);
		return { instructions: [
			...instructions,
			attrib,
			modTypeInstr
		] };
	};
}
function main(context) {
	context.requireExtension("Fallout New Vegas Sanity Checks", void 0, true);
	context.registerGame({
		id: GAME_ID,
		name: "Fallout:	New Vegas",
		setup: (discovery) => prepareForModding(context.api, discovery),
		shortName: "New Vegas",
		mergeMods: true,
		queryPath: findGame,
		requiresLauncher,
		supportedTools: tools,
		queryModPath: () => "Data",
		logo: "gameart.jpg",
		executable: () => "FalloutNV.exe",
		requiredFiles: ["FalloutNV.exe"],
		environment: { SteamAPPId: "22380" },
		details: {
			steamAppId: 22380,
			nexusPageId: NEXUS_DOMAIN_NAME,
			hashFiles: ["Data/Update.bsa", "Data/FalloutNV.esm"]
		}
	});
	context.registerInstaller("falloutnv-4gb-patch", 25, testInstaller4GBPatch(context.api), applyInstaller4GBPatch(context.api));
	return true;
}
module.exports = { default: main };

//#endregion
//# sourceMappingURL=index.js.map