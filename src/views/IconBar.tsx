import { IActionDefinition, IActionOptions } from '../types/IIconDefinition';
import { IExtensibleProps, extend } from '../util/ExtensionProvider';

import DynamicProps from './DynamicProps';
import Icon from './Icon';
import ToolbarIcon from './ToolbarIcon';

import * as React from 'react';
import { ButtonGroup, DropdownButton, MenuItem } from 'react-bootstrap';

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

/**
 * represents an extensible row of icons/buttons
 * In the simplest form this is simply a bunch of buttons that will run
 * an action if clicked, but an icon can also be more dynamic (i.e. rendering
 * dynamic content or having multiple states)
 * 
 * @class IconBar
 * @extends {ComponentEx<IProps, {}>}
 */
class IconBar extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { collapse, id, objects, orientation, className, style } = this.props;

    if (collapse) {
      const dotdotdot: any = <Icon name='ellipsis-v' />;
      let collapsed: IActionDefinition[] = [];
      let unCollapsed: IActionDefinition[] = [];

      objects.forEach(action => {
        if ((action.options === undefined) || !action.options.noCollapse) {
          collapsed.push(action);
        } else {
          unCollapsed.push(action);
        }
      });

      return (
        <ButtonGroup
          id={id}
          className={className + ' btngroup-collapsed'}
          style={style}
        >
          { collapsed.length === 0 ? null : <DropdownButton
            className='btn-embed'
            id={`btn-menu-${id}`}
            noCaret
            title={dotdotdot}
            bsStyle='default'
            pullRight={true}
          >
            {collapsed.sort(iconSort).map(this.renderMenuItem)}
          </DropdownButton> }
          {unCollapsed.sort(iconSort).map(this.renderIcon)}
        </ButtonGroup>);
    } else {
      return (
        <ButtonGroup
          id={id}
          className={className}
          style={style}
          vertical={orientation === 'vertical'}
        >
          {this.props.children}
          {objects.sort(iconSort).map(this.renderIcon)}
        </ButtonGroup>
      );
    }
  }

  private renderMenuItem = (icon: IActionDefinition, index: number) => {
    const { instanceId } = this.props;

    const id = `${instanceId || '1'}_${index}`;
    return <MenuItem key={id} eventKey={id}>{this.renderIconInner(icon, index, 'menu')}</MenuItem>;
  }

  private renderIcon = (icon: IActionDefinition, index: number) =>
    this.renderIconInner(icon, index);

  private renderIconInner = (icon: IActionDefinition, index: number,
                             forceButtonType?: ButtonType) => {
    const { buttonType, instanceId, tooltipPlacement } = this.props;

    const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;

    // don't render anything if the condition doesn't match
    try {
      if ((icon.condition !== undefined) && !icon.condition(instanceIds)) {
        return null;
      }
    } catch (err) {
      return null;
    }

    const id = `${instanceId || '1'}_${index}`;
    if (icon.icon !== undefined) {
      // simple case
      return <ToolbarIcon
        key={id}
        id={id}
        instanceId={instanceIds}
        icon={icon.icon}
        text={icon.title}
        onClick={icon.action}
        placement={tooltipPlacement}
        buttonType={forceButtonType || buttonType}
      />;
    } else {
      // custom case. the caller can pass properties via the props() function and by
      // passing the prop to the iconbar. the props on the iconbar that we don't handle are
      // passed on
      const knownProps = [ 'condition', 'className', 'group', 't', 'i18nLoadedAt',
                           'objects', 'children' ];
      const unknownProps = Object.keys(this.props).reduce((prev: any, current: string) => {
        if (knownProps.indexOf(current) === -1) {
          return Object.assign({}, prev, { [current]: this.props[current] });
        } else {
          return prev;
        }
      }, {});
      const staticProps = Object.assign({},
        unknownProps,
        { key: id, buttonType: forceButtonType || buttonType },
      );
      if (icon.props !== undefined) {
        return <DynamicProps
          key={id}
          dynamicProps={icon.props}
          staticProps={staticProps}
          component={icon.component}
        />;
      } else {
        return <icon.component {...staticProps} />;
      }
    }
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
function registerAction(instance: IconBar,
                        group: string,
                        position: number,
                        iconOrComponent: string | React.ComponentClass<any>,
                        options: IActionOptions,
                        titleOrProps?: string | Function,
                        actionOrCondition?: (instanceIds?: string[]) => void | boolean,
                        condition?: () => boolean,
                        ): Object {
  if (instance.props.group === group) {
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

export default
  extend(registerAction)(IconBar
  ) as React.ComponentClass<IBaseProps & IExtensibleProps & React.HTMLAttributes<any> & any>;
