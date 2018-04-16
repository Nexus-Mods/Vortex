import { IActionDefinition } from '../types/IActionDefinition';
import { IExtensibleProps } from '../util/ExtensionProvider';

import ActionControl, { IActionControlProps, IActionDefinitionEx } from './ActionControl';
import Dropdown from './Dropdown';
import Icon from './Icon';
import ToolbarIcon from './ToolbarIcon';
import { IconButton } from './TooltipControls';

import * as update from 'immutability-helper';
import * as _ from 'lodash';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import { ButtonGroup, MenuItem } from 'react-bootstrap';
import { Overlay } from 'react-overlays';

export type ButtonType = 'text' | 'icon' | 'both' | 'menu';

export interface IBaseProps {
  className?: string;
  group?: string;
  instanceId?: string | string[];
  tooltipPlacement?: 'top' | 'right' | 'bottom' | 'left';
  buttonType?: ButtonType;
  orientation?: 'horizontal' | 'vertical';
  collapse?: boolean | 'force';
  filter?: (action: IActionDefinition) => boolean;
  icon?: string;
  pullRight?: boolean;
}

type IProps = IBaseProps & { actions?: IActionDefinitionEx[] } & React.HTMLAttributes<any>;

// takes the props of a Popover. ignores the arrow, applies the absolute
// position
function Positioner(props: any): JSX.Element {
  const { children, positionLeft, positionTop } = props;

  return (
    <div
      className={props.className}
      style={{ top: positionTop, left: positionLeft, position: 'absolute' }}
    >
      <div className='menu-content'>{children}</div>
    </div>
  );
}

interface IPortalMenuProps {
  open: boolean;
  target: JSX.Element;
  onClick: (evt) => void;
  onClose: () => void;
}

class PortalMenu extends React.Component<IPortalMenuProps, {}> {
  public static contextTypes: React.ValidationMap<any> = {
    menuLayer: PropTypes.object,
  };

  public context: { menuLayer: JSX.Element };

  public render() {
    const { onClick, onClose, open, target } = this.props;

    return (
      <Overlay
        show={open}
        container={this.context.menuLayer}
        placement='bottom'
        target={target}
      >
        <Positioner className='icon-menu-positioner'>
          <Dropdown.Menu
            style={{ display: 'block', position: 'initial' }}
            onClose={onClose}
            open={open}
            onClick={onClick}
          >
            {this.props.children}
          </Dropdown.Menu>
        </Positioner>
      </Overlay>
    );
  }
}

function genTooltip(show: boolean | string): string {
  return typeof (show) === 'string'
    ? show
    : undefined;
}

interface IMenuActionProps {
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
        title={genTooltip(action.show)}
      >
        {/*this.renderIconInner(icon, index, 'menu')*/}
        <Icon name={action.icon} />
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

  public context: { menuLayer: JSX.Element };

  private portalTargetRef: JSX.Element;

  constructor(props: IProps) {
    super(props);

    this.state = {
      open: false,
    };
  }

  public render(): JSX.Element {
    const { actions, collapse, icon, id, instanceId,
            orientation, className, style } = this.props;
    const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;

    const classes: string[] = [];
    if (className) {
      classes.push(className);
    }

    if (collapse) {
      classes.push('btngroup-collapsed');

      const collapsed: IActionDefinition[] = [];
      const unCollapsed: IActionDefinition[] = [];

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
            rotateId={`dots-iconbar-${id}`}
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
      return (
        <ButtonGroup
          id={id}
          className={classes.join(' ')}
          style={style}
          vertical={orientation === 'vertical'}
        >
          {this.props.children}
          {actions.map(this.renderIcon)}
        </ButtonGroup>
      );
    }
  }

  private renderMenuItem =
    (icon: IActionDefinition & { show: boolean | string }, index: number) => {
    const { instanceId } = this.props;

    const id = `${instanceId || '1'}_${index}`;

    if ((icon.icon === null) && (icon.component === undefined)) {
      return (
        <MenuItem className='menu-separator-line' key={id} disabled={true}>
          {icon.title}
        </MenuItem>
      );
    }

    if (icon.icon !== undefined) {
      return <MenuAction key={id} id={id} action={icon} instanceId={instanceId} />;
    } else {
      return (
        <MenuItem
          key={id}
          eventKey={id}
          disabled={icon.show !== true}
          title={genTooltip(icon.show)}
        >
          {this.renderCustomIcon(id, icon)}
        </MenuItem>
      );
    }
  }

  private renderIcon = (icon: IActionDefinition, index: number) => {
    if ((icon.icon === null) && (icon.component === undefined)) {
      // skip text-only elements in this mode
      return null;
    }
    return this.renderIconInner(icon, index);
  }

  private renderIconInner = (icon: IActionDefinition, index: number,
                             forceButtonType?: ButtonType) => {
    const { instanceId, tooltipPlacement } = this.props;

    const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;

    const id = `${instanceId || '1'}_${index}`;
    if (icon.icon !== undefined) {
      // simple case

      if (icon.icon === null) {
        return <p>{icon.title}</p>;
      }

      const buttonType = forceButtonType || this.props.buttonType;
      const hasIcon = (buttonType === undefined)
        || ['icon', 'both', 'menu'].indexOf(buttonType) !== -1;
      const hasText = (buttonType === undefined)
        || ['text', 'both', 'menu'].indexOf(buttonType) !== -1;

      return (
        <ToolbarIcon
          key={id}
          id={id}
          instanceId={instanceIds}
          icon={hasIcon ? icon.icon : undefined}
          text={hasText ? icon.title : undefined}
          onClick={icon.action}
          placement={tooltipPlacement}
        />
      );
    } else {
      return this.renderCustomIcon(id, icon);
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
      return <icon.component {...staticProps} {...addProps} />;
    } else {
      return <icon.component {...staticProps} />;
    }
  }

  private setPortalTargetRef = (ref) => {
    this.portalTargetRef = ref;
  }

  private toggleOpen = () => {
    this.setState(update(this.state, {
      open: { $set: !this.state.open },
      x: { $set: undefined },
      y: { $set: undefined },
    }));
  }
}

type ExportType = IBaseProps & IActionControlProps & IExtensibleProps & React.HTMLAttributes<any>;

class ActionIconBar extends React.Component<ExportType> {
  private static ACTION_PROPS = ['filter', 'group', 'instanceId', 'staticElements'];
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
