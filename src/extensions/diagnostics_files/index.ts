import { IExtensionContext } from '../../types/IExtensionContext';

import { sessionReducer } from './reducers/session';
import DiagnosticsFilesButton from './views/DiagnosticsFilesButton';
import DiagnosticsFilesDialog from './views/DiagnosticsFilesDialog';

function init(context: IExtensionContext): boolean {
  context.registerAction('help-icons', 200, DiagnosticsFilesButton, {}, () => ({}));
  context.registerReducer(['session', 'diagnosticsFiles'], sessionReducer);
  context.registerDialog('diagnostics-files-dialog', DiagnosticsFilesDialog, () => ({ context }));

  return true;
}

export default init;
