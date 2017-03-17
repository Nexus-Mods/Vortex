import Connector from './views/Connector';
import DependencyIcon from './views/DependencyIcon';
import Editor from './views/Editor';

import connectionReducer from './reducers';

import { types } from 'nmm-api';
import * as path from 'path';
import * as React from 'react';

function main(context: types.IExtensionContext) {
  context.registerTableAttribute('mods', {
    id: 'dependencies',
    name: 'Dependencies',
    description: 'Relations to other mods',
    icon: 'plug',
    placement: 'table',
    customRenderer: (mod) => <DependencyIcon mod={mod} />,
    calc: (mod) => null,
    isToggleable: true,
    edit: {},
    isSortable: false,
  });

  context.registerReducer(['session', 'dependencies'], connectionReducer);
  context.registerDialog('mod-dependencies-connector', Connector);
  context.registerDialog('mod-dependencies-editor', Editor);

  context.registerStyle(path.join(__dirname, 'dependency-manager.scss'));

  return true;
}

export default main;
