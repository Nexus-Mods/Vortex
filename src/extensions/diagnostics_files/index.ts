import { IExtensionContext } from '../../types/IExtensionContext';

import DiagnosticsFilesButton from './views/DiagnosticsFilesButton';

function init(context: IExtensionContext): boolean {
  context.registerAction('help-icons', 200, DiagnosticsFilesButton, {});

  return true;
}

export default init;
