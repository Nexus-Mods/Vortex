import { IExtensionContext } from '../../types/IExtensionContext';
import { IState } from '../../types/api';

import ModsOfTheMonthDashlet from './ModsOfTheMonthDashlet';

function init(context: IExtensionContext): boolean {

  context.registerDashlet('Mods of the Month', 1, 3, 2, ModsOfTheMonthDashlet, (state: IState) => true, () => ({}), {
    fixed: false,
    closable: true,
  });  
  
  return true;
}

export default init;