import {IExtensionApi} from '../../../types/IExtensionContext';
import Context from './contextQuery';
import Ini from './iniQuery';
import Plugins from './pluginQuery';

export class Core {
  get Plugins(): Plugins {
    return this.mPlugins;
  }
  private mExtensionApi: IExtensionApi;
  private mIni: Ini;
  private mPlugins: Plugins;

  constructor(context: IExtensionApi) {
    this.mExtensionApi = context;
    this.Initialize();
  }

  private Initialize() {
    this.mPlugins = new Plugins(this.mExtensionApi);
    this.mIni = new Ini(this.mExtensionApi);
  }
}

export default Core;
