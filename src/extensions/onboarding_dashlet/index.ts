import { IExtensionContext, ToDoType } from '../../types/IExtensionContext';

import Dashlet from './Dashlet';

import { TFunction } from 'i18next';

function init(context: IExtensionContext): boolean {
  context.registerDashlet('On Boarding', 2, 3, 0, Dashlet, state => {
    return true
  }, (() => {
    onCardClick: (videoUrl) => context.api.ext.showOverlay(videoUrl, videoUrl, videoUrl, { x: 0, y: 0 });
  }), undefined);

  return true;
}

export default init;
