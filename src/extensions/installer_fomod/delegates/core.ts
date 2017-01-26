import {IExtensionApi} from '../../../types/IExtensionContext';
import Context from './contextQuery';
import Ini from './iniQuery';
import Plugins from './pluginQuery';
import UI from './ui';

export class Core {
  get Plugins(): Plugins {
    return this.plugin;
  }

  get Context(): Context {
    return this.context;
  }

  public context: Context;
  public mExtensionApi: IExtensionApi;
  public ini: Ini;
  public plugin: Plugins;
  public ui: UI;

  constructor(api: IExtensionApi) {
    this.mExtensionApi = api;
    this.Initialize();
  }

  private Initialize() {
    this.plugin = new Plugins(this.mExtensionApi);
    this.ini = new Ini(this.mExtensionApi);
    this.ui = new UI(this.mExtensionApi);
    this.context = new Context(this.mExtensionApi);
  }
}

export default Core;
