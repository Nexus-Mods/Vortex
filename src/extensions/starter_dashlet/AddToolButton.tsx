import { StarterInfo } from '../../util/api';
import { useConnectedProps } from './useConnectedProps';

import Icon from '../../controls/Icon';

import React from 'react';
import { MenuItem } from 'react-bootstrap';
import { useStore } from 'react-redux';

import Dropdown from '../../controls/Dropdown';

import { setToolVisible } from '../gamemode_management/actions/settings';

interface IBaseProps {
  onAddNewTool: () => void;
  tools: StarterInfo[];
}

export default function AddToolButton(props: IBaseProps) {
  const { t, gameMode, discoveredTools } = useConnectedProps();
  const { tools, onAddNewTool } = props;
  const store = useStore();
  const hidden = tools.filter(starter =>
    (discoveredTools[starter.id] !== undefined)
    && (discoveredTools[starter.id].hidden === true));

  const addNewTool = React.useCallback((e) => {
    onAddNewTool();
  }, [onAddNewTool]);

  const unhide = React.useCallback((key) => {
    store.dispatch(setToolVisible(gameMode, key, true));
  }, [store]);

  return (
    <Dropdown
      id='add-tool-button'
      className='btn-add-tool dropup'
      dropup={true}
    >
      <Dropdown.Toggle noCaret className='btn-add-tool-dropdown-toggle'>
        <Icon name='add' className='btn-add-tool-icon'/>
        <div className='btn-add-tool-text'>{t('Add Tool')}</div>
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {hidden.map(starter => (
          <MenuItem
            key={starter.id}
            eventKey={starter.id}
            onSelect={unhide}
          >{starter.name}
          </MenuItem>
        ))}
        <MenuItem
          key='__add'
          onSelect={addNewTool}
        >
          {t('New...')}
        </MenuItem>
      </Dropdown.Menu>
    </Dropdown>
  );
}
