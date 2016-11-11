import { IExtensionContext } from '../../types/IExtensionContext';

function init(context: IExtensionContext): boolean {
  context.registerIcon('help-icons', 'bomb', 'About', () => {
    throw new Error('Test error reporting');
  });

  return true;
}

export default init;
