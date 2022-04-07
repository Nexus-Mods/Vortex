import { IExtensionContext } from '../../types/IExtensionContext';
import { currentGame, nexusGameId, opn } from '../../util/api';
import { dismissOverlay } from '../instructions_overlay/actions';
import { NEXUS_BASE_URL } from '../nexus_integration/constants';
import Dashlet, { IonCardClickPayload } from './Dashlet';
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
      onCardClick: (payload: IonCardClickPayload) => {
        const { title, video, desc, pos, id } = payload;

        allStepIds.filter((x) => x !== id).forEach((x) => {
          // Close all the other overlays if there is any overlay of this kind open
          context.api.store.dispatch(dismissOverlay(x));
        });

        context.api.ext.showOverlay(id, undefined, Overlay, pos, {
          containerTitle: title,
          showIcon: false,
          className: 'overlay-onboarding',
          disableCollapse: true,
          props: () => ({
            desc,
            url: video,
            id,
            isCompleted: context.api.store.getState().settings.onboardingsteps?.steps[id]
          }),
        });
      },
      getMoreMods: () => {
        currentGame(context.api.store)
        .then(game => {
          const nxsGameId = nexusGameId(game) 
          opn(`${NEXUS_BASE_URL}/${nxsGameId !== '__placeholder' ? nxsGameId : 'mods'}`).catch(err => undefined);
        });
      },
      steps: STEPS,
      completed: context.api.store.getState().settings.onboardingsteps,
    }),
    undefined);

  return true;
}

export default init;
