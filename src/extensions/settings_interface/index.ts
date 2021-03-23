import { IExtensionContext } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import { setTimeMode } from '../../util/relativeTime';
import automationReducer from './reducers/automation';
import settingsReducer from './reducers/interface';
import SettingsInterface from './SettingsInterface';

function init(context: IExtensionContext): boolean {
  context.registerReducer(['settings', 'interface'], settingsReducer);
  context.registerReducer(['settings', 'automation'], automationReducer);
  context.registerSettings('Interface', SettingsInterface, undefined, undefined, 10);

  context.once(() => {
    context.api.onStateChange(['settings', 'interface', 'advanced'], () => {
      context.api.events.emit('refresh-main-page');
    });

    context.api.onStateChange(['settings', 'interface', 'profilesVisible'], () => {
      context.api.events.emit('refresh-main-page');
    });

    context.api.onStateChange(['settings', 'interface', 'relativeTimes'], (prev, current) => {
      setTimeMode(current ? 'relative' : 'absolute');
    });

    const state: IState = context.api.store.getState();
    setTimeMode(state.settings.interface.relativeTimes ? 'relative' : 'absolute');
  });

  return true;
}

export default init;
