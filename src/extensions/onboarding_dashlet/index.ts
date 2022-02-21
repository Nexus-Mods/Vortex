import { IExtensionContext } from '../../types/IExtensionContext';

import Dashlet, { onCardClickPayload } from './Dashlet';

import { Overlay } from './views/Overlay'

import { TFunction } from 'i18next';

import settingsReducer from "./reducers";

import { STEPS } from "./steps";

function init(context: IExtensionContext): boolean {
  context.registerReducer(['settings', 'onboardingsteps'], settingsReducer);

  context.registerDashlet('On Boarding', 2, 3, 0, Dashlet, state => {
    return true
  },
    () => ({
      onCardClick: (payload: onCardClickPayload) => {
        const { count, title, video, desc, pos, id } = payload;
        context.api.ext.showOverlay(`overlay-onboard-step-${count}`, desc, Overlay, pos, {
          containerTitle: title,
          showIcon: false,
          className: 'overlay-onboarding',
          disableCollapse: true,
          props: () => ({
            url: video,
            id: id
          })
        });
      },
      steps: STEPS,
      completed: context.api.store.getState().settings.onboardingsteps
    }),
    undefined);

  return true;
}

export default init;
