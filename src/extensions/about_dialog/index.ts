import { IExtensionContext } from '../../types/Extension';

function init(context: IExtensionContext): boolean {
  context.registerIcon('help-icons', 'question', 'About', () => alert('Hello World'));

  return true;
}

export default init;
