import {IExtensionContext} from '../../../types/IExtensionContext';
import Context from './contextQuery';
import Ini from './iniQuery';
import Plugins from './pluginQuery';

export class Core {
  get Plugins(): Plugins {
    return this.mPlugins;
  }
  private mContext: Context;
  private mCurrentContext: IExtensionContext;
  private mIni: Ini;
  private mPlugins: Plugins;

  constructor(context: IExtensionContext) {
    this.mCurrentContext = context;
    this.Initialize();
  }

  private Initialize() {
    this.mContext = new Context(this.mCurrentContext);
    this.mPlugins = new Plugins(this.mCurrentContext);
    this.mIni = new Ini(this.mCurrentContext);
  }
}

export default Core;
