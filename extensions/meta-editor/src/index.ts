
import MetaEditorDialog from './views/MetaEditorDialog';
import MetaEditorIcon from './views/MetaEditorIcon';

import sessionReducer from './reducers';

import * as path from 'path';
import { types } from 'vortex-api';

function main(context: types.IExtensionContext) {
  context.registerDialog('meta-editor-dialog', MetaEditorDialog);

  context.registerAction('downloads-action-icons', 100, MetaEditorIcon, {}, () => ({
    key: 'meta-editor-icon',
    t: context.api.translate,
  }));

  context.registerReducer(['session', 'metaEditor'], sessionReducer);

  context.once(() => {
    context.api.setStylesheet('meta-editor', path.join(__dirname, 'metaeditor.scss'));
  });

  return true;
}

export default main;
