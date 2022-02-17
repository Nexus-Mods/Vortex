import { IExtensionContext, ToDoType } from '../../types/IExtensionContext';

import Dashlet, { onCardClickPayload } from './Dashlet';

import { Overlay } from './views/Overlay'

import { TFunction } from 'i18next';

function init(context: IExtensionContext): boolean {
  context.registerDashlet('On Boarding', 2, 3, 0, Dashlet, state => {
    return true
  }, 
  () => ({
    onCardClick: (payload: onCardClickPayload) => {
      const {count, title, video, desc, pos } = payload;
      context.api.ext.showOverlay(`overlay-onboard-step-${count}`, desc, Overlay, pos, {
        containerTitle: title,
        showIcon: false,
        className: 'overlay-onboarding',
        props: {
          url: video,
        }
      });
    }
  }), 
  undefined);

  return true;
}

export default init;
