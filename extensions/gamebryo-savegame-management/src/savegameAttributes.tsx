import { ISavegame } from './types/ISavegame';
import CharacterFilter from './util/CharacterFilter';
import PluginList from './views/PluginList';
import ScreenshotCanvas from './views/ScreenshotCanvas';

import { TableTextFilter, types } from 'nmm-api';
import * as React from 'react';

export const SAVEGAME_ID: types.ITableAttribute = {
  id: 'id',
  name: 'Savegame id',
  description: 'Id of the savegame',
  icon: 'id-badge',
  calc: (savegame: ISavegame) => (savegame.attributes as any).id,
  placement: 'both',
  isToggleable: true,
  isSortable: true,
  isDefaultVisible: false,
  edit: {},
};

export const CHARACTER_NAME: types.ITableAttribute = {
  id: 'name',
  name: 'Character name',
  description: 'Name of the character',
  icon: 'quote-left',
  calc: (savegame: ISavegame) => (savegame.attributes as any).name,
  placement: 'both',
  isToggleable: true,
  isSortable: true,
  filter: new CharacterFilter(),
  edit: {},
  sortFunc: (lhs: string, rhs: string, locale: string): number => {
    return lhs.localeCompare(rhs, locale, { sensitivity: 'base' });
  },
};

export const LEVEL: types.ITableAttribute = {
  id: 'level',
  name: 'Character level',
  description: 'Level of the character',
  icon: 'level-up',
  calc: (savegame: ISavegame) => (savegame.attributes as any).level,
  placement: 'both',
  isToggleable: true,
  isSortable: true,
  edit: {},
};

export const LOCATION: types.ITableAttribute = {
  id: 'location',
  name: 'Ingame location',
  description: 'Location during the save',
  icon: 'map-marker',
  calc: (savegame: ISavegame) => (savegame.attributes as any).location,
  placement: 'both',
  isToggleable: true,
  isSortable: true,
  edit: {},
};

export const CREATION_TIME: types.ITableAttribute = {
  id: 'creationtime',
  name: 'Creation Time',
  description: 'File creation time',
  icon: 'calendar-plus-o',
  calc: (savegame: ISavegame) => new Date((savegame.attributes as any).creationtime),
  placement: 'both',
  isToggleable: true,
  isSortable: true,
  edit: {},
};

export const SCREENSHOT: types.ITableAttribute = {
  id: 'screenshot',
  name: 'Screenshot',
  description: 'Savegame screenshot',
  icon: ' file-picture-o',
  customRenderer: (savegame: ISavegame) => <ScreenshotCanvas save={savegame} />,
  calc: (savegame: ISavegame) => ((savegame.attributes as any).screenshot),
  placement: 'detail',
  isToggleable: false,
  edit: {},
};

export const PLUGINS: types.ITableAttribute = {
  id: 'plugins',
  name: 'Plugins',
  description: 'Savegame plugins',
  icon: 'file-picture-o',
  customRenderer: (savegame: ISavegame) =>
    <PluginList plugins={(savegame.attributes as any).plugins} />,
  calc: (savegame: ISavegame) => (savegame.attributes as any).plugins,
  placement: 'detail',
  isToggleable: false,
  edit: {},
};

export const FILENAME: types.ITableAttribute = {
  id: 'filename',
  name: 'Filename',
  description: 'Name of the file',
  icon: 'file-picture-o',
  calc: (savegame: ISavegame) => (savegame.attributes as any).filename,
  placement: 'both',
  isToggleable: true,
  isSortable: true,
  isDefaultVisible: false,
  filter: new TableTextFilter(true),
  edit: {},
};
