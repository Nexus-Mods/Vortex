import { types } from 'nmm-api';

import MetaEditorIcon from './views/MetaEditorIcon';

import * as path from 'path';

function main(context: types.IExtensionContext) {
  context.registerAction('downloads-action-icons', 100, MetaEditorIcon, {}, () => ({
    key: 'meta-editor-icon',
    t: context.api.translate,
  }));

  context.registerStyle(path.join(__dirname, 'metaeditor.scss'));

  return true;
}

export default main;
