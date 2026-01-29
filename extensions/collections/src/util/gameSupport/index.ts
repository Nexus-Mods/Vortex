import * as gamebryo from "./gamebryo";

import { types } from "vortex-api";
import { ICollection } from "../../types/ICollection";
import { IExtendedInterfaceProps } from "../../types/IExtendedInterfaceProps";
import { IGameSupportEntry } from "../../types/IGameSupportEntry";

const gameSupport: { [gameId: string]: IGameSupportEntry } = {
  skyrim: {
    generator: gamebryo.generate,
    parser: gamebryo.parser,
    interface: gamebryo.Interface,
  },
  skyrimse: {
    generator: gamebryo.generate,
    parser: gamebryo.parser,
    interface: gamebryo.Interface,
  },
  skyrimvr: {
    generator: gamebryo.generate,
    parser: gamebryo.parser,
    interface: gamebryo.Interface,
  },
  fallout3: {
    generator: gamebryo.generate,
    parser: gamebryo.parser,
    interface: gamebryo.Interface,
  },
  fallout4: {
    generator: gamebryo.generate,
    parser: gamebryo.parser,
    interface: gamebryo.Interface,
  },
  fallout4vr: {
    generator: gamebryo.generate,
    parser: gamebryo.parser,
    interface: gamebryo.Interface,
  },
  falloutnv: {
    generator: gamebryo.generate,
    parser: gamebryo.parser,
    interface: gamebryo.Interface,
  },
  starfield: {
    generator: gamebryo.generate,
    parser: gamebryo.parser,
    interface: gamebryo.Interface,
  },
  oblivion: {
    generator: gamebryo.generate,
    parser: gamebryo.parser,
    interface: gamebryo.Interface,
  },
  enderal: {
    generator: gamebryo.generate,
    parser: gamebryo.parser,
    interface: gamebryo.Interface,
  },
  enderalspecialedition: {
    generator: gamebryo.generate,
    parser: gamebryo.parser,
    interface: gamebryo.Interface,
  },
};

export function generateGameSpecifics(
  state: types.IState,
  gameId: string,
  stagingPath: string,
  modIds: string[],
  mods: { [modId: string]: types.IMod },
): Promise<any> {
  if (
    gameSupport[gameId] !== undefined &&
    gameSupport[gameId].generator !== undefined
  ) {
    return gameSupport[gameId].generator(
      state,
      gameId,
      stagingPath,
      modIds,
      mods,
    );
  } else {
    return Promise.resolve({});
  }
}

export function parseGameSpecifics(
  api: types.IExtensionApi,
  gameId: string,
  collection: ICollection,
  collectionMod: types.IMod,
): Promise<void> {
  if (
    gameSupport[gameId] !== undefined &&
    gameSupport[gameId].parser !== undefined
  ) {
    return gameSupport[gameId].parser(api, gameId, collection, collectionMod);
  } else {
    return Promise.resolve();
  }
}

export function getInterface(
  gameId: string,
): React.ComponentType<IExtendedInterfaceProps> {
  if (gameSupport[gameId] === undefined) {
    return null;
  } else {
    return gameSupport[gameId].interface;
  }
}
