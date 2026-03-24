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
    versionMap: [
      // Pre-Anniversary Edition (SE 1.5.x)
      { gameVersionRange: ">=1.5.0 <1.5.62", label: "SE (1.5.53)", scriptExtenderVersion: "2.0.7" },
      { gameVersionRange: ">=1.5.62 <1.5.73", label: "SE (1.5.62)", scriptExtenderVersion: "2.0.10" },
      { gameVersionRange: ">=1.5.73 <1.5.80", label: "SE (1.5.73)", scriptExtenderVersion: "2.0.15" },
      { gameVersionRange: ">=1.5.80 <1.5.97", label: "SE (1.5.80)", scriptExtenderVersion: "2.0.16" },
      { gameVersionRange: ">=1.5.97 <1.6.0", label: "SE (1.5.97)", scriptExtenderVersion: "2.0.20" },
      // Anniversary Edition (AE 1.6.x)
      { gameVersionRange: ">=1.6.0 <1.6.323", label: "AE (1.6.318)", scriptExtenderVersion: "2.1.0" },
      { gameVersionRange: ">=1.6.323 <1.6.342", label: "AE (1.6.323)", scriptExtenderVersion: "2.1.1" },
      { gameVersionRange: ">=1.6.342 <1.6.353", label: "AE (1.6.342)", scriptExtenderVersion: "2.1.2" },
      { gameVersionRange: ">=1.6.353 <1.6.629", label: "AE (1.6.353)", scriptExtenderVersion: "2.1.3" },
      { gameVersionRange: ">=1.6.629 <1.6.640", label: "AE (1.6.629)", scriptExtenderVersion: "2.2.0" },
      { gameVersionRange: ">=1.6.640 <1.6.1130", label: "AE (1.6.640)", scriptExtenderVersion: "2.2.3" },
      { gameVersionRange: ">=1.6.1130", label: "AE (Latest)", scriptExtenderVersion: "2.2.6" },
    ],
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
    versionMap: [
      // Pre-Next-Gen (1.10.x, pre-980)
      { gameVersionRange: ">=1.10.0 <1.10.50", label: "Early post-launch", scriptExtenderVersion: "0.4.0" },
      { gameVersionRange: ">=1.10.50 <1.10.75", label: "Pre-CC", scriptExtenderVersion: "0.5.0" },
      { gameVersionRange: ">=1.10.75 <1.10.82", label: "CC era (1.10.75)", scriptExtenderVersion: "0.6.0" },
      { gameVersionRange: ">=1.10.82 <1.10.89", label: "CC era (1.10.82)", scriptExtenderVersion: "0.6.5" },
      { gameVersionRange: ">=1.10.89 <1.10.98", label: "CC era (1.10.89)", scriptExtenderVersion: "0.6.9" },
      { gameVersionRange: ">=1.10.98 <1.10.120", label: "CC era (1.10.98)", scriptExtenderVersion: "0.6.13" },
      { gameVersionRange: ">=1.10.120 <1.10.130", label: "CC era (1.10.120)", scriptExtenderVersion: "0.6.17" },
      { gameVersionRange: ">=1.10.130 <1.10.138", label: "CC era (1.10.130)", scriptExtenderVersion: "0.6.20" },
      { gameVersionRange: ">=1.10.138 <1.10.162", label: "CC era (1.10.138)", scriptExtenderVersion: "0.6.21" },
      { gameVersionRange: ">=1.10.162 <1.10.980", label: "Pre-Next-Gen (1.10.162)", scriptExtenderVersion: "0.6.23" },
      // Next-Gen Update (2024+)
      { gameVersionRange: ">=1.10.980", label: "Next-Gen", scriptExtenderVersion: "0.7.0" },
    ],
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
