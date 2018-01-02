import * as path from 'path';

interface IGameSupport {
  fileFilter: (fileName: string) => boolean;
  targetAge: Date;
}

const gameSupport: { [gameId: string]: IGameSupport } = {
  skyrim: {
    fileFilter: (fileName: string) =>
      fileName.startsWith('Skyrim - ')
      && path.extname(fileName).toLowerCase() === '.bsa',
    targetAge: new Date(2008, 10, 1),
  },
  skyrimse: {
    fileFilter: (fileName: string) =>
      fileName.startsWith('Skyrim - ')
      && path.extname(fileName).toLowerCase() === '.bsa',
    targetAge: new Date(2008, 10, 1),
  },
  fallout4: {
    fileFilter: (fileName: string) =>
      fileName.startsWith('Fallout4 - ')
      && path.extname(fileName).toLowerCase() === '.ba2',
    targetAge: new Date(2008, 10, 1),
  },
  fallout4vr: {
    fileFilter: (fileName: string) =>
      (fileName.startsWith('Fallout4 - ') || (fileName.startsWith('Fallout4_VR - ')))
      && path.extname(fileName).toLowerCase() === '.ba2',
    targetAge: new Date(2008, 10, 1),
  },
};

export function isSupported(gameId: string): boolean {
  return gameSupport[gameId] !== undefined;
}

export function fileFilter(gameId: string): (fileName: string) => boolean {
  return gameSupport[gameId].fileFilter;
}

export function targetAge(gameId: string): Date {
  return gameSupport[gameId].targetAge;
}
