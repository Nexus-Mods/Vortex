import {IExtensionApi} from '../../../types/IExtensionContext';
import Context from './Context';
import UI from './UI';

export class Core {
  public context: Context;
  // public ui: UI; - soon

  constructor(api: IExtensionApi, gameId: string, modLoaderPath) {
    // this.ui = new UI(api, gameId);
    this.context = new Context(api, gameId, modLoaderPath);
  }

  public detach() {
    // this.ui.detach();
    this.context.detach();
  }
}

export default Core;
