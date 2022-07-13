import { IStarterInfo } from '../../util/StarterInfo';

import { useTranslation } from 'react-i18next';

import Icon from '../../controls/Icon';
import { getSafe } from '../../util/storeHelper';

import React from 'react';
import * as ReactDOM from 'react-dom';
import { MenuItem } from 'react-bootstrap';
import { useSelector, useStore } from 'react-redux';

import Dropdown from '../../controls/Dropdown';
import PortalMenu from '../../controls/PortalMenu';

import { setToolVisible } from '../gamemode_management/actions/settings';

import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { IState } from '../../types/IState';
import * as selectors from '../../util/selectors';

import { IGameStored } from '../gamemode_management/types/IGameStored';

interface IBaseProps {
  onAddNewTool: () => void;
  tools: IStarterInfo[];
  onSetToolOrder: (order: string[]) => void;
}

interface IConnectedProps {
  toolsOrder: string[];
  gameMode: string;
  discoveredTools: { [id: string]: IDiscoveredTool };
  primaryTool: string;
}

export default function AddToolButton(props: IBaseProps) {
  const [t] = useTranslation();
  const { gameMode, discoveredTools, toolsOrder } = useSelector(mapStateToProps);
  const { tools, onAddNewTool, onSetToolOrder } = props;
  const store = useStore();
  const hidden = tools.filter(starter =>
    (discoveredTools[starter.id] !== undefined)
    && (discoveredTools[starter.id].hidden === true));

  const dropRef = React.useRef();
  const [open, setOpen] = React.useState(false);
  const setToolOrder = React.useCallback((newOrder: string[]) => {
    onSetToolOrder(newOrder);
  }, [onSetToolOrder]);
  const addNewTool = React.useCallback((e) => {
    onAddNewTool();
  }, [onAddNewTool]);

  React.useEffect(() => {
    const hiddenIds = Object.values(hidden).map(tool => tool.id);
    const newOrder = toolsOrder.reduce((prev, iter) => {
      if (!hiddenIds.includes(iter)) {
        prev.push(iter);
      }
      return prev;
    }, []);
    if (hidden.length !== newOrder.length) {
      setToolOrder(newOrder);
    }
  }, [discoveredTools]);

  const unhide = React.useCallback((key) => {
    store.dispatch(setToolVisible(gameMode, key, true));
  }, [store]);

  const classes = ['btn-add-tool'];
  if (tools.length - hidden.length > 3) {
    classes.push('dropup');
  }
  if (gameMode === undefined) {
    return null;
  }

  const setRef = (ref) => {
    dropRef.current = ReactDOM.findDOMNode(ref) as any;
  }

  const onToggleOpen = React.useCallback(() => {
    setOpen(true);
  }, [setOpen]);

  const onToggleClose = React.useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  return (
    <Dropdown
      id='add-tool-button-menu'
      className={classes.join(' ')}
      ref={setRef}
    >
      <Dropdown.Toggle noCaret className='btn-add-tool-dropdown-toggle' open={open} onClick={onToggleOpen}>
        <Icon name='add' className='btn-add-tool-icon'/>
        <div className='btn-add-tool-text'>{t('Add Tool')}</div>
      </Dropdown.Toggle>
      <PortalMenu
        onClick={nop}
        onClose={onToggleClose}
        open={open}
        target={dropRef.current}
        bsRole='menu'
      >
        {hidden.map(starter => (
          <MenuItem
            key={starter.id}
            eventKey={starter.id}
            onSelect={unhide}
          >
            {starter.name}
          </MenuItem>
        ))}
        <MenuItem
          key='__add'
          onSelect={addNewTool}
        >
          {t('New...')}
        </MenuItem>
      </PortalMenu>
    </Dropdown>
  );
}

const emptyObj = {};
function mapStateToProps(state: IState): IConnectedProps {
  const game: IGameStored = selectors.currentGame(state);
  if (game?.id === undefined) {
    return {
      gameMode: undefined,
      toolsOrder: [],
      discoveredTools: emptyObj,
      primaryTool: undefined,
    };
  }

  return {
    gameMode: game.id,
    toolsOrder: getSafe(state,
      ['settings', 'interface', 'tools', 'order', game.id], []),
    discoveredTools: getSafe(state,
      ['settings', 'gameMode', 'discovered', game.id, 'tools'], emptyObj),
    primaryTool: getSafe(state, ['settings', 'interface', 'primaryTool', game.id], undefined),
  };
}

function nop() {
  // nop
}
