import { IActionDefinitionEx } from './ActionControl';
import Dropdown from './Dropdown';
import Icon from './Icon';

import * as React from 'react';
import { MenuItem } from 'react-bootstrap';
import { Portal } from 'react-overlays';
import { ComponentEx } from '../util/ComponentEx';

export interface IMenuActionProps {
  id: string;
  action: IActionDefinitionEx;
  instanceId: string | string[];
}

class MenuAction extends React.PureComponent<IMenuActionProps, {}> {
  public render(): JSX.Element {
    const { action, id } = this.props;
    return (
      <MenuItem
        eventKey={id}
        onSelect={this.trigger}
        disabled={action.show !== true}
        title={typeof(action.show) === 'string' ? action.show : undefined}
      >
        {action.icon !== undefined ? <Icon name={action.icon} /> : null}
        <div className='button-text'>{action.title}</div>
      </MenuItem>
    );
  }

  private trigger = () => {
    const { action, instanceId } = this.props;

    const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;

    action.action(instanceIds);
  }
}

class RootCloseWrapper extends React.Component<{ onClose: () => void }, {}> {
  public componentDidMount() {
    document.addEventListener('click', this.props.onClose);
    document.addEventListener('contextmenu', this.props.onClose);
  }

  public componentWillUnmount() {
    document.removeEventListener('click', this.props.onClose);
    document.removeEventListener('contextmenu', this.props.onClose);
  }

  public render() {
    return this.props.children;
  }
}

export interface IContextMenuProps {
  position: { x: number, y: number };
  visible: boolean;
  onHide: () => void;
  instanceId: string;
}

type IProps = IContextMenuProps & { actions?: IActionDefinitionEx[] };

class ContextMenu extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { actions, children, onHide, position, visible } = this.props;
    if (!visible) {
      return null;
    }

    return (
      <RootCloseWrapper onClose={onHide}>
        <Portal
          container={this.context.menuLayer}
        >
          <div
            style={{ left: position.x, top: position.y, position: 'absolute' }}
          >
            <div className='menu-content'>{children}</div>
            <Dropdown.Menu
              style={{ display: 'block', position: 'initial' }}
              onClose={onHide}
              open={true}
              onClick={onHide}
            >
              {actions.map(this.renderMenuItem)}
            </Dropdown.Menu>
          </div>
        </Portal>
      </RootCloseWrapper>
    );
  }

  private renderMenuItem = (action: IActionDefinitionEx, index: number) => {
    const { instanceId } = this.props;

    const id = `${instanceId || '1'}_${index}`;

    if ((action.icon === null) && (action.component === undefined)) {
      return (
        <MenuItem className='menu-separator-line' key={id} disabled={true}>
          {action.title}
        </MenuItem>
      );
    }

    return <MenuAction key={id} id={id} action={action} instanceId={instanceId} />;
  }
}

export default ContextMenu as React.ComponentClass<IContextMenuProps>;
