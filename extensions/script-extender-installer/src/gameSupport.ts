import { IGameSupport } from "./types";
import * as xseAttributes from "./xse-attributes.json";

const supportData: { [gameId: string]: IGameSupport } = {
  skyrim: {
    name: "Skyrim Script Extender (SKSE)",
    gameName: "Skyrim",
    gameId: "skyrim",
    scriptExtExe: "skse_loader.exe",
    website: "http://skse.silverlock.org/",
    regex: /(beta\/skse_[0-9]+_[0-9]+_[0-9]+.7z)/i,
    attributes: (xseVersion) => {
      return [
        { type: "attribute", key: "version", value: xseVersion } as any,
        ...xseAttributes.skyrim,
      ];
    },
    toolId: "skse",
    nexusMods: {
      gameId: "skyrim",
      modId: 100216,
    },
  },
  skyrimse: {
    name: "Skyrim Script Extender 64 (SKSE64)",
    gameName: "Skyrim SE",
    gameId: "skyrimse",
    scriptExtExe: "skse64_loader.exe",
    website: "http://skse.silverlock.org/",
    regex: /(beta\/skse64_[0-9]+_[0-9]+_[0-9]+.7z)/i,
    attributes: (xseVersion) => {
      return [
        { type: "attribute", key: "version", value: xseVersion } as any,
        ...xseAttributes.skyrimse,
      ];
    },
    toolId: "skse64",
    nexusMods: {
      gameId: "skyrimspecialedition",
      modId: 30379,
    },
  },
  skyrimvr: {
    name: "Skyrim Script Extender VR (SKSEVR)",
    gameName: "Skyrim VR",
    gameId: "skyrimvr",
    scriptExtExe: "sksevr_loader.exe",
    website: "http://skse.silverlock.org/",
    regex: /(beta\/sksevr_[0-9]+_[0-9]+_[0-9]+.7z)/i,
    attributes: (xseVersion) => {
      return [
        { type: "attribute", key: "version", value: xseVersion } as any,
        ...xseAttributes.skyrimvr,
      ];
    },
    toolId: "sksevr",
    nexusMods: {
      gameId: "skyrimspecialedition",
      modId: 30457,
    },
  },
  fallout4: {
    name: "Fallout 4 Script Extender (F4SE)",
    gameName: "Fallout 4",
    gameId: "fallout4",
    scriptExtExe: "f4se_loader.exe",
    website: "http://f4se.silverlock.org/",
    regex: /(beta\/f4se_[0-9]+_[0-9]+_[0-9]+.7z)/i,
    attributes: (xseVersion) => {
      return [
        { type: "attribute", key: "version", value: xseVersion } as any,
        ...xseAttributes.fallout4,
      ];
    },
    toolId: "f4se",
    nexusMods: {
      gameId: "fallout4",
      modId: 42147,
    },
  },
  fallout4vr: {
    name: "Fallout 4 Script Extender VR (F4SE)",
    gameName: "Fallout 4 VR",
    gameId: "fallout4vr",
    scriptExtExe: "f4sevr_loader.exe",
    website: "http://f4se.silverlock.org/",
    regex: /(beta\/f4sevr_[0-9]+_[0-9]+_[0-9]+.7z)/i,
    attributes: (xseVersion) => {
      return [
        { type: "attribute", key: "version", value: xseVersion } as any,
        ...xseAttributes.fallout4vr,
      ];
    },
    toolId: "F4SEVR",
    nexusMods: {
      gameId: "fallout4",
      modId: 42159,
    },
  },
  falloutnv: {
    name: "New Vegas Script Extender (NVSE)",
    gameName: "Fallout NV",
    gameId: "falloutnv",
    scriptExtExe: "nvse_loader.exe",
    website: "https://github.com/xNVSE/NVSE/",
    regex: /(nvse_[0-9]+_[0-9]+_[a-zA-Z0-9]+.7z)/i,
    attributes: (xseVersion) => {
      return [
        { type: "attribute", key: "version", value: xseVersion } as any,
        ...xseAttributes.falloutnv,
      ];
    },
    gitHubAPIUrl: "https://api.github.com/repos/xNVSE/NVSE",
    toolId: "nvse",
    nexusMods: {
      gameId: "newvegas",
      modId: 67883,
    },
  },
  fallout3: {
    name: "Fallout Script Extender (FOSE)",
    gameName: "Fallout 3",
    gameId: "fallout3",
    scriptExtExe: "fose_loader.exe",
    website: "http://fose.silverlock.org/",
    regex: /(download\/fose_v[0-9]+_[0-9]+_[a-zA-Z0-9]+.7z)/i,
    attributes: (xseVersion) => {
      return [
        { type: "attribute", key: "version", value: xseVersion } as any,
        ...xseAttributes.fallout3,
      ];
    },
    toolId: "fose",
    nexusMods: {
      gameId: "fallout3",
      modId: 8606,
    },
  },
  oblivion: {
    name: "Oblivion Script Extender (OBSE)",
    gameName: "Oblivion",
    gameId: "oblivion",
    scriptExtExe: "obse_loader.exe",
    website: "https://github.com/llde/xOBSE",
    regex: /^(xOBSE-?[0-9]+\.[0-9]+.*\.(zip|7z))$/i,
    attributes: (xseVersion) => {
      return [
        { type: "attribute", key: "version", value: xseVersion } as any,
        ...xseAttributes.oblivion,
      ];
    },
    gitHubAPIUrl: "https://api.github.com/repos/llde/xOBSE",
    toolId: "obse",
    nexusMods: {
      gameId: "oblivion",
      modId: 37952,
    },
  },
};

export default supportData;
