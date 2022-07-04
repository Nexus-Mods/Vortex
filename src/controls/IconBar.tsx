import { IActionDefinition } from '../types/IActionDefinition';
import { IExtensibleProps } from '../types/IExtensionProvider';
import { TFunction } from '../util/i18n';
import { setdefault } from '../util/util';

import ActionControl, { IActionControlProps, IActionDefinitionEx } from './ActionControl';
import { HOVER_DELAY } from './constants';
import Icon from './Icon';
import PortalMenu from './PortalMenu';
import ToolbarDropdown from './ToolbarDropdown';
import ToolbarIcon from './ToolbarIcon';
import { IconButton } from './TooltipControls';

import update from 'immutability-helper';
import * as _ from 'lodash';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import { ButtonGroup, Dropdown, MenuItem } from 'react-bootstrap';
import ReactDOM from 'react-dom';

export type ButtonType = 'text' | 'icon' | 'both' | 'menu';

export interface IBaseProps {
  className?: string;
  group?: string;
  instanceId?: string | string[];
  tooltipPlacement?: 'top' | 'right' | 'bottom' | 'left';
  buttonType?: ButtonType;
  orientation?: 'horizontal' | 'vertical';
  collapse?: boolean | 'force';
  groupByIcon?: boolean;
  filter?: (action: IActionDefinition) => boolean;
  icon?: string;
  pullRight?: boolean;
  clickAnywhere?: boolean;
  showAll?: boolean;
  t: TFunction;
}

type IProps = IBaseProps & { actions?: IActionDefinitionEx[] } & React.HTMLAttributes<any>;

function genTooltip(t: TFunction, show: boolean | string, ns?: string): string {
  return typeof (show) === 'string'
    ? t(show, { ns })
    : undefined;
}

interface IMenuActionProps {
  id: string;
  action: IActionDefinitionEx;
  instanceId: string | string[];
  t: TFunction;
}

class MenuAction extends React.PureComponent<IMenuActionProps, {}> {
  public render(): JSX.Element {
    const { t, action, id } = this.props;
    return (
      <MenuItem
        eventKey={id}
        onSelect={this.trigger}
        disabled={action.show !== true}
        title={genTooltip(t, action.show, action.options?.namespace)}
      >
        <Icon name={action.icon} />
        <div className='button-text'>{t(action.title, { ns: action.options?.namespace })}</div>
      </MenuItem>
    );
  }

  private trigger = () => {
    const { action, instanceId } = this.props;

    const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;

    action.action(instanceIds);
  }
}

interface IIconBarIconProps {
  t: TFunction;
  actionId: string;
  icon: IActionDefinitionEx;
  instanceIds: string[];
  buttonType: ButtonType;
  tooltipPlacement?: 'top' | 'right' | 'bottom' | 'left';
}

function nop() {
  // nop
}

function IconBarIcon(props: IIconBarIconProps) {
  const { t, actionId, buttonType, icon, instanceIds, tooltipPlacement } = props;

  // stuff for submenus
  const [open, setOpenMenu] = React.useState(false);
  const [subMenus, setSubMenus] = React.useState<IActionDefinitionEx[]>([]);

  const setOpen = React.useCallback((value: React.SetStateAction<boolean>) => {
    if (Array.isArray(icon.subMenus)) {
      setSubMenus(icon.subMenus);
    } else {
      setSubMenus(icon.subMenus());
    }
    setOpenMenu(value);
  }, [setOpenMenu, icon.subMenus]);

  const itemRef = React.useRef<HTMLElement>();

  const trigger = React.useCallback(() => {
    icon.action?.(instanceIds, icon.data);
    if (icon.subMenus !== undefined) {
      setOpen(old => !old);
    }
  }, [instanceIds, icon, setOpen]);

  const setOpenFalse = React.useCallback(() => { setOpen(false); }, [ setOpen ]);

  const hasIcon = (buttonType === undefined)
    || ['icon', 'both', 'menu'].includes(buttonType);
  const hasText = (buttonType === undefined)
    || ['text', 'both', 'menu'].includes(buttonType);

  const tooltip = (typeof(icon.show) === 'string')
    ? icon.show
    : t(icon.title, { ns: icon.options?.namespace });

  const setItemRef = (ref) => {
    itemRef.current = ReactDOM.findDOMNode(ref) as HTMLElement;
  };

  return (
    <ToolbarIcon
      key={actionId}
      ref={setItemRef}
      className={actionId}
      instanceId={instanceIds}
      icon={hasIcon ? icon.icon : undefined}
      text={hasText ? t(icon.title, { ns: icon.options?.namespace }) : undefined}
      tooltip={tooltip}
      onClick={trigger}
      placement={tooltipPlacement}
      disabled={(icon.show !== true) && (icon.show !== undefined)}
      stroke={icon.options?.hollowIcon === true}
      hollow={icon.options?.hollowIcon === true}
    >
      <PortalMenu
        open={open}
        target={itemRef.current}
        onClose={setOpenFalse}
        onClick={nop}
      >
        {(subMenus ?? []).map(subMenu =>
          <MenuAction
            t={t}
            key={subMenu.title}
            id={subMenu.title}
            action={subMenu}
            instanceId={actionId}
          />)}
      </PortalMenu>
    </ToolbarIcon>
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
class IconBar extends React.Component<IProps, { open: boolean }> {
  public static contextTypes: React.ValidationMap<any> = {
    menuLayer: PropTypes.object,
  };

  public declare context: { menuLayer: JSX.Element };

  private portalTargetRef: Element;
  private mBackgroundClick: (evt: React.MouseEvent<ButtonGroup>) => void;

  constructor(props: IProps) {
    super(props);

    this.state = {
      open: false,
    };

    this.updateBGClick();
  }

  public UNSAFE_componentWillReceiveProps() {
    this.updateBGClick();
  }

  public render(): JSX.Element {
    const { actions, collapse, icon, id, groupByIcon,
            orientation, className, style } = this.props;

    const classes: string[] = [];
    if (className) {
      classes.push(className);
    }

    if (collapse) {
      classes.push('btngroup-collapsed');

      const collapsed: IActionDefinitionEx[] = [];
      const unCollapsed: IActionDefinitionEx[] = [];

      actions.forEach(action => {
        if ((collapse === 'force')
            || ((action.options === undefined) || !action.options.noCollapse)) {
          collapsed.push(action);
        } else {
          unCollapsed.push(action);
        }
      });

      const moreButton = (collapsed.length === 0) ? null : (
        <div>
          <IconButton
            id={`btn-menu-${id}`}
            className='btn-embed'
            onClick={this.toggleOpen}
            tooltip={''}
            icon={icon || 'menu'}
            stroke
            ref={this.setPortalTargetRef}
          />
          <PortalMenu
            open={this.state.open}
            target={this.portalTargetRef}
            onClose={this.toggleOpen}
            onClick={this.toggleOpen}
          >
            {this.state.open ? collapsed.map(this.renderMenuItem) : null}
          </PortalMenu>
        </div>
      );

      return (
        <ButtonGroup
          id={id}
          className={classes.join(' ')}
          style={style}
        >
          {moreButton}
          {unCollapsed.map((iter, idx) => (
            <div key={idx}>{this.renderIcon(iter, idx)}</div>))}
        </ButtonGroup>
      );
    } else {
      const groupedByIcon: { [key: string]: IActionDefinition[] } =
        actions.reduce((prev: { [key: string]: IActionDefinition[] }, action, idx) => {
          if ((action.icon !== undefined) && (groupByIcon !== false)) {
            setdefault(prev, action.icon, []).push(action);
          } else {
            prev[idx.toString()] = [action];
          }
          return prev;
        }, {});
      const byFirstPrio = (lhs: IActionDefinition[], rhs: IActionDefinition[]) => {
        return lhs[0].position - rhs[0].position;
      };

      const groupByGroup = (prev: { [group: string]: IActionDefinitionEx[][] },
                            actionList: IActionDefinitionEx[]) => {
        const group = actionList[0].group ?? '__unset';
        if (prev[group] === undefined) {
          prev[group] = [actionList];
        } else {
          prev[group].push(actionList);
        }
        return prev;
      };

      const grouped = Object.values(groupedByIcon)
        .sort(byFirstPrio)
        .reduce(groupByGroup, {});

      return (
        <ButtonGroup
          id={id}
          className={classes.join(' ')}
          style={style}
          vertical={orientation === 'vertical'}
          onClick={this.mBackgroundClick}
        >
          {this.props.children}
          {(Object.keys(grouped).length !== 1)
            ? Object.keys(grouped).map((groupId, idx) => (
              <div className='iconbar-actiongroup' key={groupId}>
                {grouped[groupId].map(this.renderIcons)}
              </div>
            ))
            : Object.values(grouped)[0].map(this.renderIcons)
          }
        </ButtonGroup>
      );
    }
  }

  private renderMenuItem =
    (icon: IActionDefinitionEx, index: number) => {
    const { t, instanceId } = this.props;

    const id = `${instanceId || '1'}_${index}`;

    if ((icon.icon === null) && (icon.component === undefined)) {
      return (
        <MenuItem className='menu-separator-line' key={id} disabled={true}>
          {t(icon.title, { ns: icon.options?.namespace })}
        </MenuItem>
      );
    }

    if (icon.icon !== undefined) {
      return <MenuAction key={id} id={id} action={icon} instanceId={instanceId} t={t} />;
    } else {
      return (
        <MenuItem
          key={id}
          eventKey={id}
          disabled={icon.show !== true}
          title={genTooltip(t, icon.show)}
        >
          {this.renderCustomIcon(id, icon)}
        </MenuItem>
      );
    }
  }

  private renderIcon = (icon: IActionDefinitionEx, index: number) => {
    if ((icon.icon === null) && (icon.component === undefined)) {
      // skip text-only elements in this mode
      return null;
    }
    return this.renderIconInner(icon, index);
  }

  private renderIcons = (icons: IActionDefinitionEx[], index: number) => {
    if (icons.length === 1) {
      if ((icons[0].icon === null) && (icons[0].component === undefined)) {
        // skip text-only elements in this mode
        return null;
      }
      return this.renderIconInner(icons[0], index);
    } else {
      return this.renderIconGroup(icons, index);
    }
  }

  private renderIconGroup = (icons: IActionDefinition[], index: number) => {
    const { t, instanceId, orientation, buttonType } = this.props;

    const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;

    const id = `${instanceId || '1'}_${index}`;

    return (
      <ToolbarDropdown
        t={t}
        key={id}
        id={id}
        instanceId={instanceIds}
        icons={icons}
        buttonType={buttonType}
        orientation={orientation}
      />
    );
  }

  private renderIconInner = (icon: IActionDefinitionEx, index: number,
                             forceButtonType?: ButtonType) => {
    const { t, instanceId, tooltipPlacement } = this.props;

    const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;

    let actionId = (icon.title || index.toString()).toLowerCase().replace(/ /g, '-');
    actionId = `action-${actionId}`;
    if (icon.component === undefined) {
      return (
        <IconBarIcon
          key={actionId}
          t={t}
          actionId={actionId}
          buttonType={forceButtonType || this.props.buttonType}
          icon={icon}
          instanceIds={instanceIds}
          tooltipPlacement={tooltipPlacement ?? 'top'}
        />
      );
    } else {
      return this.renderCustomIcon(actionId, icon);
    }
  }

  private renderCustomIcon(id: string, icon: IActionDefinition) {
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
    if (icon.props !== undefined) {
      const addProps = icon.props();
      return <icon.component {...staticProps} {...addProps} parentType='iconbar' />;
    } else {
      return <icon.component {...staticProps} parentType='iconbar' />;
    }
  }

  private setPortalTargetRef = (ref) => {
    this.portalTargetRef = ref;
  }

  private toggleOpen = () => {
    this.setState(update(this.state, {
      open: { $set: !this.state.open },
    }));
  }

  private updateBGClick() {
    const {actions, clickAnywhere, instanceId} = this.props;
    const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;
    this.mBackgroundClick = ((clickAnywhere === true) && (actions.length === 1))
      ? ((evt: React.MouseEvent<ButtonGroup>) => {
        // don't trigger if the button itself was clicked
        if (!evt.isDefaultPrevented()) {
          evt.preventDefault();
          actions[0].action(instanceIds);
        }
      })
      : undefined;
  }
}

type ExportType = IBaseProps & IActionControlProps & IExtensibleProps & React.HTMLAttributes<any>;

class ActionIconBar extends React.Component<ExportType> {
  private static ACTION_PROPS = ['filter', 'group', 'instanceId', 'showAll', 'staticElements'];
  public render() {
    const actionProps: IActionControlProps =
      _.pick(this.props, ActionIconBar.ACTION_PROPS) as IActionControlProps;
    const barProps: IBaseProps =
      _.omit(this.props, ActionIconBar.ACTION_PROPS) as any;
    return (
      <ActionControl {...actionProps}>
        <IconBar {...barProps} />
      </ActionControl>
    );
  }
}

export default ActionIconBar as React.ComponentClass<ExportType>;
