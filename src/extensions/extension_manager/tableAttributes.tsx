import { ITableAttribute } from '../../types/ITableAttribute';

import { IExtensionWithState } from './types';

import * as React from 'react';

interface IAttributesContext {
  onSetExtensionEnabled: (extensionId: string, enabled: boolean) => void;
  onToggleExtensionEnabled: (extensionId: string) => void;
}

function getTableAttributes(context: IAttributesContext):
              Array<ITableAttribute<IExtensionWithState>> {
  return [{
      id: 'enabled',
      name: 'Status',
      description: 'Is mod enabled in current profile',
      icon: 'check-o',
      calc: extension => extension.enabled ? 'Enabled' : 'Disabled',
      placement: 'table',
      isToggleable: false,
      edit: {
        inline: true,
        choices: () => [
          { key: 'enabled', text: 'Enabled' },
          { key: 'disabled', text: 'Disabled' },
        ],
        onChangeValue: (extId: string, value: string) =>
          value === undefined
            ? context.onToggleExtensionEnabled(extId)
            : context.onSetExtensionEnabled(extId, value === 'enabled'),
      },
      isSortable: false,
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
    },
  ];
}

export default getTableAttributes;
