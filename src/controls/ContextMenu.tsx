import { IActionDefinitionEx } from './ActionControl';
import Dropdown from './Dropdown';
import Icon from './Icon';

import * as React from 'react';
import { MenuItem } from 'react-bootstrap';
import { Portal } from 'react-overlays';
import { ComponentEx } from '../util/ComponentEx';
import { TFunction } from '../util/i18n';

export interface IMenuActionProps {
  t: TFunction;
  id: string;
  action: IActionDefinitionEx;
  instanceId: string | string[];
}

class MenuAction extends React.PureComponent<IMenuActionProps, {}> {
  public render(): JSX.Element {
    const { t, action, id } = this.props;
    return (
      <MenuItem
        eventKey={id}
        onSelect={this.trigger}
        disabled={action.show !== true}
        title={typeof(action.show) === 'string' ? t(action.show) : undefined}
      >
        {(action.component !== undefined)
          ? this.renderCustom()
          : (<>
              {action.icon !== undefined ? <Icon name={action.icon} /> : null}
              <div className='button-text'>{t(action.title)}</div>
            </>)}
      </MenuItem>
    );
  }

  private renderCustom() {
    const { action, id } = this.props;

    const knownProps = ['condition', 'className', 'group', 't', 'i18nLoadedAt',
      'objects', 'children'];
    const unknownProps = Object.keys(this.props).reduce((prev: any, current: string) => {
      if (knownProps.indexOf(current) === -1) {
        return {
          ...prev,
          [current]: this.props[current],
        };
      } else {
        return prev;
      }
    }, {});

    const staticProps = {
      ...unknownProps,
      key: id,
    };
    if (action.props !== undefined) {
      const addProps = action.props();
      return <action.component {...staticProps} {...addProps} parentType='context' />;
    } else {
      return <action.component {...staticProps} parentType='context' />;
    }
  }

  private trigger = () => {
    const { action, instanceId } = this.props;

    const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;

    action.action?.(instanceIds, action.data);
  }
}

class RootCloseWrapper extends React.Component<{ onClose: () => void }, {}> {
  public componentDidMount() {
    document.addEventListener('click', this.close);
    document.addEventListener('contextmenu', this.close);
  }

  public componentWillUnmount() {
    document.removeEventListener('click', this.close);
    document.removeEventListener('contextmenu', this.close);
  }

  public render() {
    return this.props.children;
  }

  private close = (evt: MouseEvent) => {
    if (!evt.defaultPrevented) {
      this.props.onClose();
    }
  }
}

export interface IContextPosition {
  x: number;
  y: number;
}

export interface IContextMenuProps {
  t?: TFunction;
  position?: IContextPosition;
  visible: boolean;
  onHide: () => void;
  instanceId: string;
  actions?: IActionDefinitionEx[];
  className?: string;
}

type IProps = IContextMenuProps;

interface IComponentState {
  right?: number;
  bottom?: number;
}

class ContextMenu extends ComponentEx<IProps, IComponentState> {
  private mMenuRef: HTMLDivElement = null;

  constructor(props: IProps) {
    super(props);

    this.initState({});
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if ((this.props.visible !== newProps.visible)
        && newProps.visible) {
      this.updatePlacement(newProps.position);
    }
  }

  public render(): JSX.Element {
    const { actions, children, className, onHide, position, visible } = this.props;
    const { right, bottom } = this.state;
    if (!visible || ((actions || []).length === 0)) {
      return null;
    }

    const menuStyle: React.CSSProperties = { position: 'absolute' };
    if (right !== undefined) {
      menuStyle['right'] = right;
    } else {
      menuStyle['left'] = position.x;
    }

    if (bottom !== undefined) {
      menuStyle['bottom'] = bottom;
    } else {
      menuStyle['top'] = position.y;
    }

    return (
      <RootCloseWrapper onClose={onHide}>
        <Portal
          container={this.context.menuLayer}
        >
          <div
            className={className}
            style={menuStyle}
            ref={this.setMenuRef}
          >
            <div className='menu-content'>{children}</div>
            <Dropdown.Menu
              style={{ display: 'block', position: 'initial' }}
              open={true}
              onClose={onHide}
              onClick={onHide}
            >
              {(actions || []).map(this.renderMenuItem)}
            </Dropdown.Menu>
          </div>
        </Portal>
      </RootCloseWrapper>
    );
  }

  private renderMenuItem = (action: IActionDefinitionEx, index: number) => {
    const { t, instanceId } = this.props;

    const id = `${instanceId || '1'}_${index}`;

    const tf = t ?? (input => input);

    if ((action.icon === null)
        && (action.component === undefined)
        && (action.action === undefined)) {
      return (
        <MenuItem className='menu-separator-line' key={id} disabled={true}>
          {action.title !== undefined ? tf(action.title) : <hr />}
        </MenuItem>
      );
    }

    return <MenuAction t={tf} key={id} id={id} action={action} instanceId={instanceId} />;
  }

  private setMenuRef = (ref: HTMLDivElement) => {
    this.mMenuRef = ref;
    if (ref !== null) {
      this.updatePlacement(this.props.position);
    }
  }

  private updatePlacement(position?: { x: number, y: number }) {
    if (this.mMenuRef === null) {
      return;
    }

    const rect: ClientRect = this.mMenuRef.getBoundingClientRect();
    const outer: ClientRect = (this.context.menuLayer as any).getBoundingClientRect();

    this.nextState.bottom = ((position.y + rect.height) > outer.bottom)
      ? outer.bottom - position.y
      : undefined;

    this.nextState.right = ((position.x + rect.width) > outer.right)
      ? outer.right - position.x
      : undefined;
  }
}

export default ContextMenu as React.ComponentClass<IContextMenuProps>;
