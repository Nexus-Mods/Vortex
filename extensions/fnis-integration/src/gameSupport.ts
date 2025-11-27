const gameSupport = {
  skyrim: {
    nexusSection: 'skyrim',
    fnisModId: 11811,
    patchListName: 'PatchList.txt',
  },
  enderal: {
    nexusSection: 'skyrim',
    fnisModId: 11811,
    patchListName: 'PatchList.txt',
  },
  skyrimse: {
    nexusSection: 'skyrimspecialedition',
    fnisModId: 3038,
    patchListName: 'PatchListSE.txt',
  },
  enderalspecialedition: {
    nexusSection: 'skyrimspecialedition',
    fnisModId: 3038,
    patchListName: 'PatchListSE.txt',
  },
  skyrimvr: {
    nexusSection: 'skyrimspecialedition',
    fnisModId: 3038,
    patchListName: 'PatchListVR.txt',
  },
};

export function isSupported(gameMode: string): boolean {
  return gameSupport[gameMode] !== undefined;
}

export function nexusPageURL(gameMode: string): string {
  const supp = gameSupport[gameMode];
  return `https://www.nexusmods.com/${supp.nexusSection}/mods/${supp.fnisModId}`;
}

export function patchListName(gameMode: string): string {
  return gameSupport[gameMode].patchListName;
}
