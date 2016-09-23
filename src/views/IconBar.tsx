import { IIconDefinition } from '../types/IIconDefinition';
import { ComponentEx, extend, translate } from '../util/ComponentEx';
import { IExtensibleProps } from '../util/ExtensionProvider';
import ToolbarIcon from './ToolbarIcon';

import * as React from 'react';
import { ButtonGroup } from 'react-bootstrap';

interface IProps {
  className?: string;
  group: string;
}

interface IExtensionProps {
  objects: IIconDefinition[];
}

class IconBar extends ComponentEx<IProps & IExtensionProps, {}> {

  public render(): JSX.Element {

    const { objects, className } = this.props;

    return (
      <ButtonGroup className={className}>
        { objects.map(this.renderIcon) }
      </ButtonGroup>
    );
  }

  private renderIcon = (icon: IIconDefinition) => this.renderIconImpl(icon);

  private renderIconImpl(icon: IIconDefinition) {
    const { t } = this.props;
    return <ToolbarIcon
      key={icon.title}
      id={icon.title}
      icon={icon.icon}
      tooltip={t(icon.title)}
      onClick={icon.action}
    />;
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
                      icon: string,
                      title: string,
                      action: () => void) {
  if (instance.props.group === group) {
    return { icon, title, action };
  } else {
    return undefined;
  }
}

export default
  translate(['common'], { wait: true })(
    extend(registerIcon)(IconBar)
  ) as React.ComponentClass<IProps & IExtensibleProps>;
