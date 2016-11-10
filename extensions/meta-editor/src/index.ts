import { types } from 'nmm-api';

import MetaEditorIcon from './views/MetaEditorIcon';

function main(context: types.IExtensionContext) {
  context.registerIcon('downloaditem-icons', MetaEditorIcon);

  return true;
}

export default main;
