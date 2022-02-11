import { ComponentEx } from '../util/ComponentEx';
import { TFunction } from '../util/i18n';

import { IActionDefinitionEx } from './ActionControl';
import { HOVER_DELAY } from './constants';
import Dropdown from './Dropdown';
import Icon from './Icon';

import * as React from 'react';
import { MenuItem } from 'react-bootstrap';
import ReactDOM from 'react-dom';
import { Portal } from 'react-overlays';
import { clearTimeout } from 'timers';

export interface IMenuActionProps {
  t: TFunction;
  id: string;
  action: IActionDefinitionEx;
  instanceId: string;
  onTrigger?: () => void;
}

function MenuAction(props: IMenuActionProps) {
  const { t, action, id, instanceId, onTrigger } = props;

  const renderCustom = React.useCallback(() => {
    const knownProps = ['condition', 'className', 'group', 't', 'i18nLoadedAt',
      'objects', 'children'];
    const unknownProps = Object.keys(props).reduce((prev: any, current: string) => {
      if (knownProps.indexOf(current) === -1) {
        return {
          ...prev,
          [current]: props[current],
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
  }, [props]);

  // stuff for submenus
  const [open, setOpenMenu] = React.useState(false);
  const [subMenus, setSubMenus] = React.useState([]);

  const setOpen = React.useCallback((value: React.SetStateAction<boolean>) => {
    if (subMenus.length === 0) {
      if (Array.isArray(action.subMenus)) {
        setSubMenus(action.subMenus);
      } else {
        setSubMenus(action.subMenus());
      }
    }
    setOpenMenu(value);
  }, [setOpenMenu, action.subMenus]);

  const setOpenFalse = React.useCallback(() => { setOpen(false); }, [ setOpen ]);

  const itemRef = React.useRef<HTMLElement>();

  const trigger = React.useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }

    const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;

    action.action?.(instanceIds, action.data);
    if (action.subMenus !== undefined) {
      setOpen(old => !old);
    } else {
      onTrigger?.();
    }
  }, [instanceId, action, setOpen]);

  const hideTimer = React.useRef<NodeJS.Timeout>();

  const show = React.useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
    hideTimer.current = setTimeout(() => {
      setOpen(true);
    }, HOVER_DELAY);
  }, [setOpen, hideTimer.current]);

  const hide = React.useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
    hideTimer.current = setTimeout(() => {
      setOpen(false);
    }, HOVER_DELAY);
  }, [setOpen]);

  const setItemRef = (ref) => {
    itemRef.current = ReactDOM.findDOMNode(ref) as HTMLElement;
  };

  return (
    <MenuItem
      eventKey={id}
      onSelect={trigger}
      onMouseEnter={action.subMenus !== undefined ? show : undefined}
      onMouseLeave={action.subMenus !== undefined ? hide : undefined}
      disabled={action.show !== true}
      ref={setItemRef}
      title={typeof (action.show) === 'string' ? t(action.show) : undefined}
    >
      {(action.component !== undefined)
        ? renderCustom()
        : (<>
          {action.icon !== undefined ? <Icon name={action.icon} /> : null}
          <div className='button-text'>{t(action.title)}</div>
        </>)}
      {action.subMenus !== undefined ? (
        <>
          <ContextMenu
            instanceId={instanceId}
            visible={open}
            anchor={itemRef.current}
            onHide={setOpenFalse}
            actions={subMenus}
            onTrigger={onTrigger}
          />
          <Icon className='menu-more-icon' name='showhide-right' />
        </>
      ) : null}
    </MenuItem>
  );
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
  anchor?: HTMLElement;
  visible: boolean;
  onHide: () => void;
  instanceId: string;
  actions?: IActionDefinitionEx[];
  className?: string;
  onTrigger?: () => void;
}

type IProps = IContextMenuProps;

interface IComponentState {
  right?: number;
  bottom?: number;
}

function nop() {
  // nop
}

class ContextMenu extends ComponentEx<IProps, IComponentState> {
  private mMenuRef: HTMLDivElement = null;

  constructor(props: IProps) {
    super(props);

    this.initState({
      right: 0,
      bottom: 0,
    });
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
              onClick={nop}
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

    return (
      <MenuAction
        t={tf}
        key={id}
        id={id}
        onTrigger={this.trigger}
        action={action}
        instanceId={instanceId}
      />);
  }

  private trigger = () => {
    const { onHide, onTrigger } = this.props;
    onTrigger?.();
    onHide();
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

    const rect = this.mMenuRef.getBoundingClientRect();
    const outer = (this.context.menuLayer as any).getBoundingClientRect();

    if (position !== undefined) {
      this.nextState.bottom = ((position.y + rect.height) > outer.bottom)
        ? outer.bottom - position.y
        : undefined;

      this.nextState.right = ((position.x + rect.width) > outer.right)
        ? outer.right - position.x
        : undefined;
    } else if (!!this.props.anchor) {
      const bbrect = this.props.anchor.getBoundingClientRect();
      this.nextState.bottom = Math.max(0, outer.bottom - bbrect.y - rect.height);
      let right = outer.right - bbrect.right - rect.width;
      if (right < 0) {
        right = outer.right - bbrect.left;
      }
      this.nextState.right = right;
    } else {
      this.nextState.bottom = 0;
      this.nextState.right = 0;
    }
  }
}

export default ContextMenu as React.ComponentClass<IContextMenuProps>;
