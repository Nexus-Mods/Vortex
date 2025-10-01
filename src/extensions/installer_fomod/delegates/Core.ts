import {IExtensionApi} from '../../../types/IExtensionContext';
import Context from './Context';
import Ini from './Ini';
import Plugins from './Plugins';
import UI from './UI';

export class Core {
  public context: Context;
  public ini: Ini;
  public plugin: Plugins;
  public ui: UI;
  public instanceId: string;

  constructor(api: IExtensionApi, gameId: string, unattended: boolean, instanceId: string) {
    this.plugin = new Plugins(api, gameId);
    this.ini = new Ini(api, gameId);
    this.ui = new UI(api, gameId, unattended, instanceId);
    this.instanceId = instanceId;
    this.context = new Context(api, gameId);
  }

  public detach() {
    this.plugin.detach();
    this.ini.detach();
    this.ui.detach();
    this.context.detach();
  }
}

export default Core;
