import { IModSourceOptions } from '../../../types/IExtensionContext';
import {IModSource} from '../types/IModSource';

const modSources: IModSource[] = [];

export function getModSources(): IModSource[] {
  return modSources;
}

export function getModSource(id: string): IModSource {
  return modSources.find(iter => iter.id === id);
}

export function registerModSource(id: string,
                                  name: string,
                                  onBrowse?: () => void,
                                  options?: IModSourceOptions) {
  modSources.push({ id, name, onBrowse, options });
}
