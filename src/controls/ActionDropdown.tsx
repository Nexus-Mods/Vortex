import { IActionDefinition } from '../types/IActionDefinition';
import { IExtensibleProps } from '../types/IExtensionProvider';
import { TFunction } from '../util/i18n';
import { log } from '../util/log';
import { truthy } from '../util/util';

import ActionControl, { IActionControlProps, IActionDefinitionEx } from './ActionControl';
import { HOVER_DELAY } from './constants';
import ContextMenu from './ContextMenu';
import Icon from './Icon';
import PortalMenu from './PortalMenu';

import * as _ from 'lodash';
import * as React from 'react';
import { Button, Dropdown, MenuItem } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';

export type ButtonType = 'text' | 'icon' | 'both' | 'menu';

export interface IBaseProps {
  t: TFunction;
  className?: string;
  group?: string;
  instanceId?: string | string[];
  buttonType?: ButtonType;
  orientation?: 'horizontal' | 'vertical';
}

type IProps = IBaseProps & { actions?: IActionDefinitionEx[] } & React.HTMLAttributes<any>;

function nop() {
  // nop
}

function genTooltip(show: boolean | string): string {
  return typeof (show) === 'string'
    ? show
    : undefined;
}

interface IMenuActionProps {
  t: TFunction;
  id: string;
  action: IActionDefinitionEx;
  instanceId: string | string[];
  onSelect?: () => void;
}

function MenuAction(props: IMenuActionProps) {
  const { t, action, instanceId, onSelect, id } = props;

  const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;

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
  const hideTimer = React.useRef<NodeJS.Timeout>();

  const trigger = React.useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }

    action.action?.(instanceIds, action.data);
    if (action.subMenus !== undefined) {
      setOpen(old => !old);
    } else {
      onSelect?.();
    }
  }, [instanceId, action, onSelect, setOpen]);

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
      title={genTooltip(action.show)}
    >
      <Icon name={action.icon} />
      <div className='button-text'>{t(action.title)}</div>
      {action.subMenus !== undefined ? (
        <>
          <ContextMenu
            instanceId={instanceId[0]}
            visible={open}
            anchor={itemRef.current}
            onHide={setOpenFalse}
            actions={subMenus}

          />
          <Icon className='menu-more-icon' name='showhide-right' />
        </>
      ) : null}
    </MenuItem>
  );
}

/**
 * represents an extensible row of icons/buttons/actions
 * In the simplest form this is simply a bunch of buttons that will run
 * an action if clicked, but an icon can also be more dynamic (i.e. rendering
 * dynamic content or having multiple states)
 *
 * @class IconBar
 * @extends {ComponentEx<IProps, {}>}
 */
class DropdownMenu extends React.PureComponent<IProps, { open: boolean }> {
  private mRef: Element;

  constructor(props: IProps) {
    super(props);

    this.state = { open: false };
  }

  public render(): JSX.Element {
    const { t, actions, id, className } = this.props;

    const classes: string[] = [];
    if (className) {
      classes.push(className);
    }

    const defaultIdx = actions.findIndex(act => act.show === true);
    if (defaultIdx === -1) {
      return null;
    }
    const rest = actions.slice(0);
    rest.splice(defaultIdx, 1);

    const title: any = (
      <div
        title={genTooltip(actions[defaultIdx].show)}
        style={{ width: '100%', height: '100%' }}
      >
        <Icon name={actions[defaultIdx].icon} />
        {t(actions[defaultIdx].title)}
      </div>
    );

    const btn = (
      <Button
        onClick={actions[defaultIdx].show ? this.triggerDefault : undefined}
        data-value={actions[defaultIdx].title}
      >
        {title}
      </Button>
    );

    if (rest.length === 0) {
      return btn;
    }

    return (
      <Dropdown
        id={`${id}-menu`}
        ref={this.setRef}
      >
        {btn}
        <Dropdown.Toggle open={this.state.open} onClick={this.toggleOpen} />
        <PortalMenu
          open={this.state.open}
          target={this.mRef}
          onClose={this.close}
          onClick={nop}
          bsRole='menu'
        >
          {rest.map((iter, idx) => this.renderMenuItem(iter, idx))}
        </PortalMenu>
      </Dropdown>
    );
  }

  private setRef = (ref: any) => {
    this.mRef = ReactDOM.findDOMNode(ref) as any;
  }

  private close = () => {
    this.setState({ open: false });
  }

  private toggleOpen = (evt: React.MouseEvent<any>) => {
    evt.preventDefault();
    this.setState({ open: !this.state.open });
  }

  private renderMenuItem =
    (action: IActionDefinitionEx, index: number) => {
      const { t, instanceId } = this.props;

      const id = `${instanceId || '1'}_${index}`;

      if ((action.icon === null) && (action.component === undefined)) {
        return (
          <MenuItem className='menu-separator-line' key={id} disabled={true}>
            {t(action.title)}
          </MenuItem>
        );
      }

      if (action.icon !== undefined) {
        return <MenuAction t={t} key={id} id={id} action={action} instanceId={instanceId} />;
      } else {
        return (
          <MenuItem
            key={id}
            eventKey={id}
            disabled={action.show !== true}
            title={genTooltip(action.show)}
          >
            {this.renderCustomIcon(id, action)}
          </MenuItem>
        );
      }
    }

  private renderCustomIcon(id: string, action: IActionDefinition) {
    // custom case. the caller can pass properties via the props() function and by
    // passing the prop to the iconbar. the props on the iconbar that we don't handle are
    // passed on
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
      buttonType: this.props.buttonType,
      orientation: this.props.orientation,
    };
    if (action.props !== undefined) {
      const addProps = action.props();
      return <action.component {...staticProps} {...addProps} parentType='dropdown' />;
    } else {
      return <action.component {...staticProps} parentType='dropdown' />;
    }
  }

  private triggerDefault = (evt: React.MouseEvent<any>) => {
    const { instanceId, actions } = this.props;
    const data = evt.currentTarget.attributes.getNamedItem('data-value');
    if (data === undefined) {
      log('error', 'no default action', JSON.stringify(actions));
      return;
    }
    const title = data.value;
    const action = actions.find(iter => iter.title === title);
    if (action !== undefined) {
      const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;
      action.action?.(instanceIds);
    }
  }
}

type ExportType = IBaseProps & IActionControlProps & IExtensibleProps & React.HTMLAttributes<any>;

class ActionDropdown extends React.Component<ExportType> {
  private static ACTION_PROPS = ['filter', 'group', 'instanceId', 'staticElements'];
  public render() {
    const actionProps: IActionControlProps =
      _.pick(this.props, ActionDropdown.ACTION_PROPS) as IActionControlProps;
    const menuProps: IBaseProps =
      _.omit(this.props, ActionDropdown.ACTION_PROPS) as any;
    return (
      <ActionControl {...actionProps}>
        <DropdownMenu {...menuProps} />
      </ActionControl>
    );
  }
}

export default ActionDropdown as React.ComponentClass<ExportType>;
