import {ILoadOrder} from './ILoadOrder';

import {Message, PluginCleaningData, Priority, Tag} from 'loot';

/**
 * generic information about a plugin
 *
 * @export
 * @interface IPlugin
 */
export interface IPlugin {
  /**
   * name of the mod that installed this plugin
   * may be undefined if this plugin was not installed with Vortex
   *
   * @type {string}
   * @memberOf IPlugin
   */
  modName?: string;
  filePath?: string;
  /**
   * specifies whether this is a "native" plugin, that is: One
   * where the load order is hard-coded into the game engine so
   * we have no influence on if/when it is loaded.
   *
   * @type {boolean}
   * @memberOf IPlugin
   */
  isNative: boolean;
}

export interface IPlugins { [fileName: string]: IPlugin; }

/**
 * details retrieved from the content of a plugin through esptk
 *
 * @export
 * @interface IPluginParsed
 */
export interface IPluginParsed {
  isMaster: boolean;
  parseFailed: boolean;
  masterList: string[];
  author: string;
  description: string;
}

export interface IPluginLoot {
  messages: Message[];
  cleanliness: PluginCleaningData[];
  dirtyness: PluginCleaningData[];
  tags: Tag[];
  localPriority: Priority;
  globalPriority: Priority;
}

export interface IPluginUserlist {
  localPriority?: Priority;
  globalPriority?: Priority;
}

export interface IPluginsLoot { [fileName: string]: IPluginLoot; }

export type IPluginCombined = IPlugin & ILoadOrder & IPluginParsed
                            & IPluginLoot & IPluginUserlist & {
  /**
   * file name of the plugin
   *
   * @type {string}
   */
  name: string,
  /**
   * mod index of the plugin as used in form-ids. Please note that this is
   * directly derived from other attributes, namely 'enabled', 'isNative' and
   * 'loadOrder'
   *
   * @type {number}
   */
  modIndex: number,
  eslIndex?: number,
};
