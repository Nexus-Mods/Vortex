import { IModSourceOptions } from '../../../types/IExtensionContext';

export interface IModSource {
  id: string;
  name: string;
  onBrowse?: () => void;
  options?: IModSourceOptions;
}
