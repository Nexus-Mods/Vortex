
import { setDialogVisible } from '../../actions/session';
import { IExtensionContext } from '../../types/IExtensionContext';

import DiagnosticsFilesDialog from './views/DiagnosticsFilesDialog';

function init(context: IExtensionContext): boolean {
  context.registerAction('global-icons', 190, 'bug', {}, 'Diagnostics Files',
    () => { context.api.store.dispatch(setDialogVisible('diagnostics-files-dialog')); });

  context.registerDialog('diagnostics-files-dialog', DiagnosticsFilesDialog);

  return true;
}

export default init;
