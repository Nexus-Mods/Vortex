export class NBindBase { free?(): void }

export type GameId = 'oblivion' | 'skyrim' | 'skyrimse' | 'fallout3' | 'falloutnv' | 'fallout4';
export type Cleanliness = 'clean' | 'dirty' | 'do_not_clean' | 'unknown';
export type MessageType = 'say' | 'warn' | 'error' | 'unknown';

export class LootDatabase extends NBindBase {
  constructor(gameId: GameId, gamePath: string, gameLocalPath: string);

  updateMasterlist(masterlistPath: string, repoUrl: string, repoBranch: string,
                   callback: (err: Error, didUpdate: boolean) => void): void;

  getMasterlistRevision(masterlistPath: string, getShortId: boolean): MasterlistInfo;

  loadLists(masterlistPath: string, userlistPath: string, callback: (err: Error, value: void) => void): void;

  evalLists(callback: (err: Error, value: void) => void): void;

  getPluginMessages(pluginName: string, language: string): SimpleMessage[];

  getPluginCleanliness(pluginName: string): Cleanliness;

  getPluginTags(pluginName: string): PluginTags;

  sortPlugins(pluginNames: string[]): string[];
}

export class MasterlistInfo extends NBindBase {
  revisionId: string;
  revisionDate: string;
  isModified: boolean;
}

export class PluginTags extends NBindBase {
  added: string[];
  removed: string[];
  userlistModified: boolean;
}

export class SimpleMessage extends NBindBase {
  type: MessageType;
  language: string;
  text: string;
}

export function IsCompatible(major: number, minor: number, patch: number): boolean;
