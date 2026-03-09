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
let react = require("react");
react = __toESM(react);
let relaxed_json = require("relaxed-json");
relaxed_json = __toESM(relaxed_json);

//#region extensions/games/game-masterchiefcollection/common.ts
const MCC_LOCAL_LOW = path.default.resolve(vortex_api.util.getVortexPath("appData"), "..", "LocalLow", "MCC");
const MOD_MANIFEST_FILE = "ModManifest.txt";
const MOD_MANIFEST_FILE_PATH = path.default.join(MCC_LOCAL_LOW, "Config", MOD_MANIFEST_FILE);
const MOD_INFO_JSON_FILE = "modinfo.json";
const HALO1_MAPS_RELPATH = path.default.join("halo1", "maps");
const MS_APPID = "Microsoft.Chelan";
const STEAM_ID = "976730";
const GAME_ID = "halothemasterchiefcollection";
const MOD_CONFIG_FILE = "modpack_config.cfg";
const MOD_CONFIG_DEST_ELEMENT = "$MCC_home\\";
const ASSEMBLY_EXT = ".asmp";
const MAP_EXT = ".map";
const MODTYPE_PLUG_AND_PLAY = "halo-mcc-plug-and-play-modtype";
const HALO_GAMES = {
	halo1: {
		internalId: "1",
		name: "Halo: CE",
		modsPath: "halo1",
		img: path.default.join(__dirname, "halo1.png")
	},
	halo2: {
		internalId: "2",
		name: "Halo 2",
		modsPath: "halo2",
		img: path.default.join(__dirname, "halo2.png")
	},
	halo3: {
		internalId: "3",
		name: "Halo 3",
		modsPath: "halo3",
		img: path.default.join(__dirname, "halo3.png")
	},
	odst: {
		internalId: "4",
		name: "ODST",
		modsPath: "halo3odst",
		img: path.default.join(__dirname, "odst.png")
	},
	halo4: {
		internalId: "5",
		name: "Halo 4",
		modsPath: "halo4",
		img: path.default.join(__dirname, "halo4.png")
	},
	haloreach: {
		internalId: "6",
		name: "Reach",
		modsPath: "haloreach",
		img: path.default.join(__dirname, "haloreach.png")
	}
};

//#endregion
//#region extensions/games/game-masterchiefcollection/modTypes.ts
async function testPlugAndPlayModType(instr) {
	return instr.find((instr) => instr.type === "copy" && path.default.basename(instr.source).toLowerCase() === MOD_INFO_JSON_FILE) !== void 0;
}

//#endregion
//#region extensions/games/game-masterchiefcollection/util.ts
function identifyHaloGames(files) {
	const filtered = files.filter((file) => path.default.extname(file) !== "");
	return Object.keys(HALO_GAMES).reduce((accum, key) => {
		const entry = HALO_GAMES[key];
		filtered.forEach((element) => {
			if (element.split(path.default.sep).includes(entry.modsPath)) {
				accum.push(entry);
				return accum;
			}
		});
		return accum;
	}, []);
}
async function applyToManifest(api, apply) {
	const state = api.getState();
	if (vortex_api.selectors.activeGameId(state) !== GAME_ID) return;
	let manifestData = "";
	try {
		manifestData = await vortex_api.fs.readFileAsync(MOD_MANIFEST_FILE_PATH, { encoding: "utf8" });
	} catch (err) {
		if (!["ENOENT"].includes(err.code)) {
			api.showErrorNotification("Failed to read mod manifest file", err, { allowReport: err.code !== "EPERM" });
			return;
		}
	}
	const stagingPath = vortex_api.selectors.installPathForGame(state, GAME_ID);
	const lines = manifestData.split("\r\n");
	const hasStagingFolderEntry = lines.some((line) => line.includes(stagingPath));
	if (apply && !hasStagingFolderEntry) lines.push(stagingPath);
	else if (!apply && hasStagingFolderEntry) lines.splice(lines.indexOf(stagingPath), 1);
	try {
		await vortex_api.fs.ensureDirWritableAsync(path.default.dirname(MOD_MANIFEST_FILE_PATH));
		await vortex_api.fs.writeFileAsync(MOD_MANIFEST_FILE_PATH, lines.filter((line) => !!line).join("\r\n"));
	} catch (err) {
		api.showErrorNotification("Failed to write mod manifest file", err, { allowReport: err.code !== "EPERM" });
	}
}

//#endregion
//#region extensions/games/game-masterchiefcollection/installers.ts
async function testPlugAndPlayInstaller(files, gameId) {
	const hasModInfoFile = files.some((file) => path.default.basename(file).toLowerCase() === MOD_INFO_JSON_FILE);
	return Promise.resolve({
		supported: gameId === GAME_ID && hasModInfoFile,
		requiredFiles: []
	});
}
async function installPlugAndPlay(files, destinationPath) {
	const modInfo = files.find((file) => path.default.basename(file).toLowerCase() === MOD_INFO_JSON_FILE);
	const modInfoData = await vortex_api.fs.readFileAsync(path.default.join(destinationPath, modInfo), { encoding: "utf8" });
	const parsed = relaxed_json.parse(modInfoData);
	let modConfigAttributes = [];
	modConfigAttributes.push({
		type: "attribute",
		key: "haloGames",
		value: [HALO_GAMES[parsed.Engine.toLowerCase()].internalId]
	});
	if (parsed.ModVersion !== void 0) modConfigAttributes.push({
		type: "attribute",
		key: "version",
		value: `${parsed.ModVersion.Major || 0}.${parsed.ModVersion.Minor || 0}.${parsed.ModVersion.Patch || 0}`
	});
	if (parsed.Title?.Neutral !== void 0) modConfigAttributes.push({
		type: "attribute",
		key: "customFileName",
		value: parsed.Title.Neutral
	});
	const infoSegments = modInfo.split(path.default.sep);
	const modFolderIndex = infoSegments.length >= 1 ? infoSegments.length - 1 : 0;
	const instructions = files.filter((file) => path.default.extname(path.default.basename(file)) !== "").map((file) => {
		return {
			type: "copy",
			source: file,
			destination: file.split(path.default.sep).slice(modFolderIndex).join(path.default.sep)
		};
	});
	instructions.push(...modConfigAttributes);
	return Promise.resolve({ instructions });
}
function testModConfigInstaller(files, gameId) {
	const isAssemblyOnlyMod = () => {
		return files.find((file) => path.default.extname(file) === ASSEMBLY_EXT) !== void 0 && files.find((file) => path.default.extname(file) === MAP_EXT) === void 0;
	};
	return gameId !== GAME_ID ? Promise.resolve({
		supported: false,
		requiredFiles: []
	}) : Promise.resolve({
		supported: files.find((file) => path.default.basename(file) === MOD_CONFIG_FILE) !== void 0 && !isAssemblyOnlyMod(),
		requiredFiles: []
	});
}
async function installModConfig(files, destinationPath) {
	const modConfigFile = files.find((file) => path.default.basename(file) === MOD_CONFIG_FILE);
	const filtered = files.filter((file) => {
		const segments = file.split(path.default.sep);
		const lastElementExt = path.default.extname(segments[segments.length - 1]);
		return modConfigFile !== file && [
			"",
			".txt",
			ASSEMBLY_EXT
		].indexOf(lastElementExt) === -1;
	});
	const configData = await vortex_api.fs.readFileAsync(path.default.join(destinationPath, modConfigFile), { encoding: "utf8" });
	let data;
	try {
		data = relaxed_json.parse(vortex_api.util.deBOM(configData));
	} catch (err) {
		(0, vortex_api.log)("error", "Unable to parse modpack_config.cfg", err);
		return Promise.reject(new vortex_api.util.DataInvalid("Invalid modpack_config.cfg file"));
	}
	if (!data.entries) return Promise.reject(new vortex_api.util.DataInvalid("modpack_config.cfg file contains no entries"));
	const instructions = filtered.reduce((accum, file) => {
		const matchingEntry = data.entries.find((entry) => "src" in entry && entry.src.toLowerCase() === file.toLowerCase());
		if (!!matchingEntry) {
			const destination = matchingEntry.dest.substring(MOD_CONFIG_DEST_ELEMENT.length);
			accum.push({
				type: "copy",
				source: file,
				destination
			});
		} else (0, vortex_api.log)("warn", "Failed to find matching manifest entry for file in archive", file);
		return accum;
	}, []);
	return Promise.resolve({ instructions });
}
function testInstaller(files, gameId) {
	if (gameId !== GAME_ID) return Promise.resolve({
		supported: false,
		requiredFiles: []
	});
	const haloGames = identifyHaloGames(files);
	return Promise.resolve({
		supported: haloGames.length > 0,
		requiredFiles: []
	});
}
async function install(files, destinationPath) {
	const haloGames = identifyHaloGames(files);
	const attrInstruction = {
		type: "attribute",
		key: "haloGames",
		value: haloGames.map((game) => game.internalId)
	};
	const instructions = haloGames.reduce((accum, haloGame) => {
		files.filter((file) => {
			const segments = file.split(path.default.sep).filter((seg) => !!seg);
			return path.default.extname(segments[segments.length - 1]) !== "" && segments.indexOf(haloGame.modsPath) !== -1;
		}).forEach((element) => {
			const segments = element.split(path.default.sep).filter((seg) => !!seg);
			const rootIdx = segments.indexOf(haloGame.modsPath);
			const destination = segments.splice(rootIdx).join(path.default.sep);
			accum.push({
				type: "copy",
				source: element,
				destination
			});
		});
		return accum;
	}, [attrInstruction]);
	return Promise.resolve({ instructions });
}

//#endregion
//#region extensions/games/game-masterchiefcollection/tests.ts
const MAP_NUMBER_CONSTRAINT = 28;
async function testCEMP(api) {
	const state = api.getState();
	if (vortex_api.selectors.activeGameId(state) !== GAME_ID) return Promise.resolve(void 0);
	const discovery = vortex_api.selectors.discoveryByGame(state, GAME_ID);
	if (discovery === void 0) return Promise.resolve(void 0);
	const mods = vortex_api.util.getSafe(state, [
		"persistent",
		"mods",
		GAME_ID
	], {});
	if (Object.keys(mods).filter((modId) => mods[modId]?.attributes?.haloGames.includes(HALO_GAMES.halo1.internalId)).length === 0) return Promise.resolve(void 0);
	const halo1MapsPath = path.default.join(discovery.path, HALO1_MAPS_RELPATH);
	try {
		if ((await vortex_api.fs.readdirAsync(halo1MapsPath)).length < MAP_NUMBER_CONSTRAINT) throw new Error("Not enough maps");
		return Promise.resolve(void 0);
	} catch (err) {
		const result = {
			description: {
				short: "Halo: CE Multiplayer maps are missing",
				long: "Your \"{{dirPath}}\" folder is either missing/inaccessible, or appears to not contain all the required maps. This is usually an indication that you do not have Halo: CE Multiplayer installed. Some mods may not work properly due to a bug in the game engine. Please ensure you have installed CE MP through your game store.",
				replace: { dirPath: halo1MapsPath }
			},
			severity: "warning"
		};
		return Promise.resolve(result);
	}
}

//#endregion
//#region extensions/games/game-masterchiefcollection/index.ts
var MasterChiefCollectionGame = class {
	constructor(context) {
		this.requiresLauncher = vortex_api.util.toBlue((gamePath, store) => this.checkLauncher(gamePath, store));
		this.context = context;
		this.id = GAME_ID;
		this.name = "Halo: The Master Chief Collection";
		this.shortName = "Halo: MCC";
		this.logo = "gameart.jpg";
		this.api = context.api;
		this.getGameVersion = resolveGameVersion, this.requiredFiles = [this.executable()];
		this.supportedTools = [{
			id: "haloassemblytool",
			name: "Assembly",
			logo: "assemblytool.png",
			executable: () => "Assembly.exe",
			requiredFiles: ["Assembly.exe"],
			relative: true
		}];
		this.environment = { SteamAPPId: STEAM_ID };
		this.details = { steamAppId: +STEAM_ID };
		this.mergeMods = true;
	}
	queryModPath(gamePath) {
		return ".";
	}
	executable() {
		return "mcclauncher.exe";
	}
	async prepare(discovery) {
		return Promise.resolve();
	}
	queryPath() {
		return vortex_api.util.GameStoreHelper.findByAppId([STEAM_ID, MS_APPID]).then((game) => game.gamePath);
	}
	async checkLauncher(gamePath, store) {
		if (store === "xbox") return Promise.resolve({
			launcher: "xbox",
			addInfo: {
				appId: MS_APPID,
				parameters: [{ appExecName: "HaloMCCShippingNoEAC" }]
			}
		});
		else if (store === "steam") return Promise.resolve({
			launcher: "steam",
			addInfo: {
				appId: STEAM_ID,
				parameters: ["option2"],
				launchType: "gamestore"
			}
		});
		return Promise.resolve(void 0);
	}
};
const resolveGameVersion = async (discoveryPath) => {
	const versionPath = path.default.join(discoveryPath, "build_tag.txt");
	return vortex_api.fs.readFileAsync(versionPath, { encoding: "utf8" }).then((res) => Promise.resolve(res.split("\r\n")[0].trim()));
};
module.exports = { default: (context) => {
	context.registerGame(new MasterChiefCollectionGame(context));
	context.registerModType(MODTYPE_PLUG_AND_PLAY, 15, (gameId) => gameId === GAME_ID, () => void 0, testPlugAndPlayModType, {
		deploymentEssential: false,
		mergeMods: true,
		name: "MCC Plug and Play mod",
		noConflicts: true
	});
	context.registerInstaller("mcc-plug-and-play-installer", 15, testPlugAndPlayInstaller, installPlugAndPlay);
	context.registerInstaller("masterchiefmodconfiginstaller", 20, testModConfigInstaller, installModConfig);
	context.registerInstaller("masterchiefinstaller", 25, testInstaller, install);
	context.registerTest("mcc-ce-mp-test", "gamemode-activated", vortex_api.util.toBlue(() => testCEMP(context.api)));
	context.registerTableAttribute("mods", {
		id: "gameType",
		name: "Game(s)",
		description: "Target Halo game(s) for this mod",
		icon: "inspect",
		placement: "table",
		customRenderer: (mod) => {
			const createImgDiv = (entry, idx) => {
				return react.createElement("div", {
					className: "halo-img-div",
					key: `${entry.internalId}-${idx}`
				}, react.createElement("img", {
					className: "halogameimg",
					src: `file://${entry.img}`
				}), react.createElement("span", {}, entry.name));
			};
			const internalIds = vortex_api.util.getSafe(mod, ["attributes", "haloGames"], []);
			const haloEntries = Object.keys(HALO_GAMES).filter((key) => internalIds.includes(HALO_GAMES[key].internalId)).map((key) => HALO_GAMES[key]);
			return react.createElement(vortex_api.FlexLayout, { type: "row" }, react.createElement(vortex_api.FlexLayout.Flex, { className: "haloimglayout" }, haloEntries.map((entry, idx) => createImgDiv(entry, idx))));
		},
		calc: (mod) => vortex_api.util.getSafe(mod, ["attributes", "haloGames"], void 0),
		filter: new vortex_api.OptionsFilter([].concat([{
			value: vortex_api.OptionsFilter.EMPTY,
			label: "<None>"
		}], Object.keys(HALO_GAMES).map((key) => {
			return {
				value: HALO_GAMES[key].internalId,
				label: HALO_GAMES[key].name
			};
		})), true, false),
		isToggleable: true,
		edit: {},
		isSortable: false,
		isGroupable: (mod) => {
			const internalIds = vortex_api.util.getSafe(mod, ["attributes", "haloGames"], []);
			const haloEntries = Object.keys(HALO_GAMES).filter((key) => internalIds.includes(HALO_GAMES[key].internalId)).map((key) => HALO_GAMES[key]);
			if (haloEntries.length > 1) return "Multiple";
			else return !!haloEntries && haloEntries.length > 0 ? haloEntries[0].name : "None";
		},
		isDefaultVisible: true,
		condition: () => {
			return vortex_api.selectors.activeGameId(context.api.store.getState()) === GAME_ID;
		}
	});
	context.once(() => {
		context.api.setStylesheet("masterchiefstyle", path.default.join(__dirname, "masterchief.scss"));
		context.api.onAsync("did-deploy", async (profileId) => applyToManifest(context.api, true));
		context.api.onAsync("did-purge", async (profileId) => applyToManifest(context.api, false));
	});
} };

//#endregion
//# sourceMappingURL=index.js.map