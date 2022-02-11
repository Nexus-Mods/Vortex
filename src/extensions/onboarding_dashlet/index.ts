import { IExtensionContext, ToDoType } from '../../types/IExtensionContext';

import Dashlet from './Dashlet';

import { TFunction } from 'i18next';

function init(context: IExtensionContext): boolean {
  context.registerDashlet('On Boarding', 3, 3.5 as any, 0, Dashlet, state => {
    return true
  }, undefined, undefined);

  return true;
}

export default init;
