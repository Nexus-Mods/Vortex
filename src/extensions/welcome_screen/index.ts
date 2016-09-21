import { IExtensionContext } from '../../types/IExtensionContext';
import WelcomeScreen from './WelcomeScreen';

function init(context: IExtensionContext): boolean {
  context.registerMainPage('anchor', 'Welcome', WelcomeScreen);

  return true;
}

export default init;
