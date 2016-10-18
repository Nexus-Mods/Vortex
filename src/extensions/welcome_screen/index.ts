import { IExtensionContext } from '../../types/IExtensionContext';
import WelcomeScreen from './WelcomeScreen';

function init(context: IExtensionContext): boolean {
  context.registerMainPage('anchor', 'Welcome', WelcomeScreen, {
    hotkey: '1',
  });

  return true;
}

export default init;
