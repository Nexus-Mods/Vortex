import { types } from 'nmm-api';

import MetaEditorIcon from './views/MetaEditorIcon';

import * as path from 'path';

function main(context: types.IExtensionContext) {
  context.registerIcon('downloads-action-icons', MetaEditorIcon, () => ({
    key: 'meta-editor-icon',
  }));

  context.registerStyle(path.join(__dirname, 'metaeditor.scss'));

  return true;
}

export default main;
