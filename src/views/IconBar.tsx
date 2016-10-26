import { IIconDefinition } from '../types/IIconDefinition';
import { ComponentEx, extend, translate } from '../util/ComponentEx';
import { IExtensibleProps } from '../util/ExtensionProvider';
import ToolbarIcon from './ToolbarIcon';

import * as React from 'react';
import { ButtonGroup } from 'react-bootstrap';

interface IBaseProps {
  className?: string;
  group: string;
}

interface IExtensionProps {
  objects: IIconDefinition[];
}

type IProps = IBaseProps & IExtensionProps & React.HTMLAttributes;

class IconBar extends ComponentEx<IProps, {}> {

  public render(): JSX.Element {

    const { objects, className, style } = this.props;

    return (
      <ButtonGroup className={className} style={style} >
        { objects.map(this.renderIcon) }
      </ButtonGroup>
    );
  }

  private renderIcon = (icon: IIconDefinition) => this.renderIconImpl(icon);

  private renderIconImpl(icon: IIconDefinition) {
    const { t } = this.props;
    if (icon.icon !== undefined) {
      return <ToolbarIcon
        key={icon.title}
        id={icon.title}
        icon={icon.icon}
        tooltip={t(icon.title)}
        onClick={icon.action}
      />;
    } else {
      const props = icon.props();
      return <icon.component {...props} />;
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
function registerIcon(instance: IconBar,
                      group: string,
                      iconOrComponent: string | React.ComponentClass<any>,
                      titleOrProps: string | Function,
                      action: () => void): Object {
  if (instance.props.group === group) {
    if (typeof(iconOrComponent) === 'string') {
      return { type: 'simple', icon: iconOrComponent, title: titleOrProps, action };
    } else {
      return { type: 'ext', component: iconOrComponent, props: titleOrProps };
    }
  } else {
    return undefined;
  }
}

export default
  translate(['common'], { wait: true })(
    extend(registerIcon)(IconBar)
  ) as React.ComponentClass<IBaseProps & IExtensibleProps & React.HTMLAttributes>;
