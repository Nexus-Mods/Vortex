import { IExtensionContext } from '../../types/IExtensionContext';
import { activeGameId } from '../../util/selectors';

import Starter from './Starter';

function init(context: IExtensionContext): boolean {
  context.registerDashlet('Starter', 2, 100, Starter,
    (state: any) => activeGameId(state) !== undefined);

  return true;
}

export default init;
