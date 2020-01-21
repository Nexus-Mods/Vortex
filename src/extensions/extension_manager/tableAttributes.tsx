import { IExtensionLoadFailure } from '../../types/IState';
import { ITableAttribute } from '../../types/ITableAttribute';
import { getSafe } from '../../util/storeHelper';

import { IExtensionWithState } from './types';

import I18next from 'i18next';
import * as React from 'react';

interface IAttributesContext {
  onSetExtensionEnabled: (extensionName: string, enabled: boolean) => void;
  onToggleExtensionEnabled: (extensionName: string) => void;
}

function renderLoadFailure(t: I18next.TFunction, fail: IExtensionLoadFailure) {
  const pattern = getSafe({
    'unsupported-version': 'Not compatible with this version of Vortex',
    'unsupported-api': 'Unsupported API',
    dependency: 'Depends on {{dependencyId}}',
    exception: 'Failed to load: {{message}}',
  }, [ fail.id ], 'Unknown error');
  return t(pattern, { replace: fail.args });
}

function getTableAttributes(context: IAttributesContext):
              Array<ITableAttribute<IExtensionWithState>> {
  return [{
      id: 'enabled',
      name: 'Status',
      description: 'Is mod enabled in current profile',
      icon: 'check-o',
      calc: extension => {
        switch (extension.enabled) {
          case true: return 'Enabled';
          case false: return 'Disabled';
          case 'failed': return 'Failed';
        }
      },
      placement: 'table',
      isToggleable: false,
      edit: {
        inline: true,
        choices: () => [
          { key: 'enabled', text: 'Enabled' },
          { key: 'disabled', text: 'Disabled' },
          { key: 'failed', text: 'Failed', visible: false },
        ],
        onChangeValue: (extension: IExtensionWithState, value: string) =>
          value === undefined
            ? context.onToggleExtensionEnabled(extension.name)
            : context.onSetExtensionEnabled(extension.name, value === 'enabled'),
      },
      isSortable: false,
      isGroupable: true,
    }, {
      id: 'name',
      name: 'Name',
      description: 'Extension Name',
      icon: 'quotes',
      calc: extension => extension.name,
      placement: 'table',
      isToggleable: false,
      edit: {},
      isSortable: true,
    }, {
      id: 'author',
      name: 'Author',
      description: 'Extension Author',
      icon: 'a-edit',
      calc: extension => extension.author,
      placement: 'table',
      isToggleable: true,
      edit: {},
      isSortable: true,
      isGroupable: true,
    }, {
      id: 'description',
      name: 'Description',
      description: 'Extension Description',
      placement: 'detail',
      customRenderer: (extension: IExtensionWithState) => (
        <textarea
          className='textarea-details'
          value={extension.description}
          readOnly={true}
        />
      ),
      calc: extension => extension.description,
      edit: {},
    }, {
      id: 'version',
      name: 'Version',
      description: 'Extension Version',
      icon: 'cake',
      placement: 'table',
      calc: extension => extension.version,
      isToggleable: true,
      edit: {},
      isSortable: false,
    }, {
      id: 'errors',
      name: 'Load Errors',
      description: 'Errors when loading this extension',
      icon: 'bug',
      placement: 'detail',
      calc: (extension, t) =>
        extension.loadFailures.map(fail => renderLoadFailure(t, fail)).join('\n'),
      edit: {},
    },
  ];
}

export default getTableAttributes;
