import { IExtensionContext } from '../../types/IExtensionContext';
import { dismissOverlay } from '../instructions_overlay/actions';
import Dashlet, { onCardClickPayload } from './Dashlet';
import settingsReducer from './reducers';
import { STEPS } from './steps';
import { Overlay } from './views/Overlay';

function init(context: IExtensionContext): boolean {
  context.registerReducer(['settings', 'onboardingsteps'], settingsReducer);

  const allStepIds = STEPS.map((x) => x.id);

  context.registerDashlet('On Boarding', 2, 3, 0, Dashlet, state => {
    return true;
  },
    () => ({
      onCardClick: (payload: onCardClickPayload) => {
        const { title, video, desc, pos, id } = payload;

        allStepIds.filter((x) => x !== id).forEach((x) => {
          // Close all the other overlays if there is any overlay of this kind open
          context.api.store.dispatch(dismissOverlay(x));
        });

        context.api.ext.showOverlay(id, desc, Overlay, pos, {
          containerTitle: title,
          showIcon: false,
          className: 'overlay-onboarding',
          disableCollapse: true,
          props: () => ({
            url: video,
            id,
          }),
        });
      },
      steps: STEPS,
      completed: context.api.store.getState().settings.onboardingsteps,
    }),
    undefined);

  return true;
}

export default init;
