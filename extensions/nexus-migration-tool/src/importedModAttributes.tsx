import { IFileEntry, IModEntry } from './types/nmmEntries';

import { TableDateTimeFilter, TableNumericFilter, TableTextFilter, types, util } from 'nmm-api';
import * as React from 'react';

export const MOD_ID: types.ITableAttribute = {
  id: 'id',
  name: 'Mod id',
  description: 'Nexus id of the mod',
  icon: 'id-badge',
  calc: (mod: IModEntry) => mod.nexusId,
  placement: 'both',
  isToggleable: true,
  isSortable: true,
  isDefaultVisible: false,
  edit: {},
};

export const MOD_NAME: types.ITableAttribute = {
  id: 'name',
  name: 'Mod name',
  description: 'The Name of the mod',
  icon: 'quote-left',
  calc: (mod: IModEntry) => mod.modName,
  placement: 'both',
  isToggleable: true,
  isSortable: true,
  filter: new TableTextFilter(true),
  edit: {},
  sortFunc: (lhs: string, rhs: string, locale: string): number => {
    return lhs.localeCompare(rhs, locale, { sensitivity: 'base' });
  },
};

export const MOD_VERSION: types.ITableAttribute = {
  id: 'version',
  name: 'Mod Version',
  description: 'The mod version',
  icon: 'map-marker',
  calc: (mod: IModEntry) => mod.modVersion,
  placement: 'both',
  isToggleable: true,
  isSortable: true,
  filter: new TableTextFilter(false),
  sortFunc: (lhs: string, rhs: string, locale: string): number => {
    return lhs.localeCompare(rhs, locale, { sensitivity: 'base' });
  },
  edit: {},
};

export const FILENAME: types.ITableAttribute = {
  id: 'filename',
  name: 'Mod Archive',
  description: 'The filename of the mod archive',
  icon: 'file-picture-o',
  calc: (mod: IModEntry) => mod.modFilename,
  placement: 'both',
  isToggleable: true,
  isSortable: true,
  isDefaultVisible: false,
  filter: new TableTextFilter(true),
  edit: {},
};

export const FILES: types.ITableAttribute = {
  id: 'files',
  name: 'Mod files',
  description: 'The number of files installed by this mod',
  icon: 'level-up',
  calc: (mod: IModEntry) => mod.fileEntries.length,
  placement: 'both',
  isToggleable: true,
  isSortable: true,
  filter: new TableNumericFilter(),
  sortFunc: (lhs: number, rhs: number): number => {
    return (rhs - lhs);
  },
  edit: {},
};

export const STATUS: types.ITableAttribute = {
  id: 'status',
  name: 'Import',
  description: 'The import status of the mod',
  icon: 'level-up',
  calc: (mod: IModEntry) => mod.importFlag ? 'To import' : 'Do not import',
  placement: 'both',
  isToggleable: true,
  isSortable: true,
  filter: new TableTextFilter(true),
  edit: {},
};
