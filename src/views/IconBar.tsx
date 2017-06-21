import { IActionDefinition, IActionOptions } from '../types/IActionDefinition';
import { extend, IExtensibleProps } from '../util/ExtensionProvider';
import { truthy } from '../util/util';

import DynamicProps from './DynamicProps';
import Icon from './Icon';
import ToolbarIcon from './ToolbarIcon';
import { IconButton } from './TooltipControls';

import * as update from 'immutability-helper';
import * as _ from 'lodash';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import { ButtonGroup, Dropdown, DropdownButton, MenuItem } from 'react-bootstrap';
import { Overlay } from 'react-overlays';

export type ButtonType = 'text' | 'icon' | 'both' | 'menu';

export interface IBaseProps {
  className?: string;
  group: string;
  instanceId?: string | string[];
  tooltipPlacement?: 'top' | 'right' | 'bottom' | 'left';
  buttonType?: ButtonType;
  orientation?: 'horizontal' | 'vertical';
  collapse?: boolean;
}

export interface IExtensionProps {
  objects: IActionDefinition[];
}

type IProps = IBaseProps & IExtensionProps & React.HTMLAttributes<any>;

function iconSort(lhs: IActionDefinition, rhs: IActionDefinition): number {
  return (lhs.position || 100) - (rhs.position || 100);
}

interface IPortalMenuProps {
  open: boolean;
  layer: any;
  target: JSX.Element;
  children?: React.ReactNode[];
  onClose: () => void;
}

function PortalMenu(props: IPortalMenuProps) {
  return (
    <Overlay
      show={props.open}
      container={props.layer}
      placement='bottom'
      target={props.target}
    >
      <Dropdown.Menu style={{ display: 'block' }} onClose={props.onClose} open={props.open}>
        { props.children }
      </Dropdown.Menu>
    </Overlay>
  );
}

/**
 * represents an extensible row of icons/buttons
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

  private buttonRef: JSX.Element;

  constructor(props) {
    super(props);

    this.state = {
      open: false,
    };
  }

  public render(): JSX.Element {
    const { collapse, id, instanceId, objects, orientation, className, style } = this.props;

    const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;
    const icons = objects.filter(icon => {
      // don't render anything if the condition doesn't match
      try {
        return (icon.condition === undefined)
            || icon.condition(instanceIds);
      } catch (err) {
        return false;
      }
    });

    const classes: string[] = [];
    if (className) {
      classes.push(className);
    }

    classes.push('btngroup-collapsed');

    if (collapse) {
      const dotdotdot: any = <Icon name='menu-dots' rotate={90} />;
      const collapsed: IActionDefinition[] = [];
      const unCollapsed: IActionDefinition[] = [];

      icons.forEach(action => {
        if ((action.options === undefined) || !action.options.noCollapse) {
          collapsed.push(action);
        } else {
          unCollapsed.push(action);
        }
      });

      if ((collapsed.length === 0) && (unCollapsed.length === 0)) {
        return null;
      }

      const moreButton = (
        <div className={classes.join(' ')}>
          <IconButton
            id={`btn-menu-${id}`}
            className='btn-embed'
            onClick={this.toggleCollapsed}
            tooltip={''}
            icon='menu-dots'
            rotate={90}
            ref={this.setButtonRef}
          >
            {dotdotdot}
          </IconButton>
          <PortalMenu
            layer={this.context.menuLayer}
            open={this.state.open}
            target={this.buttonRef}
            onClose={this.toggleCollapsed}
          >
            {collapsed.sort(iconSort).map(this.renderMenuItem)}
          </PortalMenu>
        </div>
          );

      if (unCollapsed.length === 0) {
        // simple case, only the more-button
        return moreButton;
      } else {
        return (
          <ButtonGroup
            id={id}
            className={classes.join(' ')}
            style={style}
          >
            {moreButton}
            {unCollapsed.sort(iconSort).map(this.renderIcon)}
          </ButtonGroup>
      );
      }
    } else {
      return (
        <ButtonGroup
          id={id}
          className={className}
          style={style}
          vertical={orientation === 'vertical'}
        >
          {this.props.children}
          {icons.sort(iconSort).map(this.renderIcon)}
        </ButtonGroup>
      );
    }
  }

  private renderMenuItem = (icon: IActionDefinition, index: number) => {
    const { instanceId } = this.props;

    const id = `${instanceId || '1'}_${index}`;

    if ((icon.icon === null) && (icon.component === undefined)) {
      return (
        <MenuItem className='menu-separator-line' key={id} disabled={true}>
          {icon.title}
        </MenuItem>
      );
    }

    return (
      <MenuItem key={id} eventKey={id}>
        {this.renderIconInner(icon, index, 'menu')}
      </MenuItem>
    );
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
    const { buttonType, instanceId, tooltipPlacement } = this.props;

    const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;

    const id = `${instanceId || '1'}_${index}`;
    if (icon.icon !== undefined) {
      // simple case

      if (icon.icon === null) {
        return <p>{icon.title}</p>;
      }

      return (
        <ToolbarIcon
          key={id}
          id={id}
          instanceId={instanceIds}
          icon={icon.icon}
          text={icon.title}
          onClick={icon.action}
          placement={tooltipPlacement}
          buttonType={forceButtonType || buttonType}
        />
      );
    } else {
      // custom case. the caller can pass properties via the props() function and by
      // passing the prop to the iconbar. the props on the iconbar that we don't handle are
      // passed on
      const knownProps = [ 'condition', 'className', 'group', 't', 'i18nLoadedAt',
                           'objects', 'children' ];
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
        buttonType: forceButtonType || buttonType,
      };
      if (icon.props !== undefined) {
        return (
          <DynamicProps
            key={id}
            dynamicProps={icon.props}
            staticProps={staticProps}
            component={icon.component}
          />
        );
      } else {
        return <icon.component {...staticProps} />;
      }
    }
  }

  private setButtonRef = (ref) => {
    this.buttonRef = ref;
  }

  private toggleCollapsed = () => {
    this.setState(update(this.state, {
      open: { $set: !this.state.open },
    }));
  }
}

/**
 * called to register an extension icon. Please note that this function is called once for every
 * icon bar in the ui for each icon. Only the bar with matching group name should accept the icon
 * by returning a descriptor object.
 *
 * @param {IconBar} instance the bar to test against. Please note that this is not actually an
 *                           IconBar instance but the Wrapper, as the bar itself is not yet
 *                           registered, but all props are there
 * @param {string} group name of the icon group this icon wants to be registered with
 * @param {string} icon name of the icon to use
 * @param {string} title title of the icon
 * @param {*} action the action to call on click
 * @returns
 */
function registerAction(instanceProps: IBaseProps,
                        group: string,
                        position: number,
                        iconOrComponent: string | React.ComponentClass<any>,
                        options: IActionOptions,
                        titleOrProps?: string | (() => any),
                        actionOrCondition?: (instanceIds?: string[]) => void | boolean,
                        condition?: () => boolean,
                        ): any {
  if (instanceProps.group === group) {
    if (typeof(iconOrComponent) === 'string') {
      return { type: 'simple', icon: iconOrComponent, title: titleOrProps,
               position, action: actionOrCondition, options, condition };
    } else {
      return { type: 'ext', component: iconOrComponent, props: titleOrProps,
               position, condition: actionOrCondition, options };
    }
  } else {
    return undefined;
  }
}

export type ExportType = IBaseProps & IExtensibleProps & React.HTMLAttributes<any> & any;

export default
  extend(registerAction)(IconBar) as React.ComponentClass<ExportType>;
