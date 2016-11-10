import SvgIcon from './Icon';

import * as React from 'react';
import { Button as BootstrapButton, NavItem as BootstrapNavItem,
         OverlayTrigger, Popover } from 'react-bootstrap';

export interface ITooltipProps {
  tooltip: string | React.Component<any, any>;
  id: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
}

export type IButtonProps = ITooltipProps & ReactBootstrap.ButtonProps;

/**
 * Button with a tooltip
 * 
 * @export
 * @class Button
 * @extends {React.Component<IProps, {}>}
 */
export class Button extends React.Component<IButtonProps, {}> {
  public render(): JSX.Element {
    let tooltip = <Popover id={this.props.id}>{this.props.tooltip}</Popover>;
    let relayProps = Object.assign({}, this.props);
    delete relayProps.tooltip;
    delete relayProps.placement;

    return (
      <OverlayTrigger
        overlay={tooltip}
        placement={this.props.placement || 'bottom'}
        delayShow={300}
        delayHide={150}
      >
        <BootstrapButton {...relayProps}>{this.props.children}</BootstrapButton>
      </OverlayTrigger>
    );
  }
}

export type INavItemProps = ITooltipProps & ReactBootstrap.NavItemProps;

export class NavItem extends React.Component<INavItemProps, {}> {
  public render(): JSX.Element {
    let tooltip = <Popover id={this.props.id}>{this.props.tooltip}</Popover>;
    let relayProps = Object.assign({}, this.props);
    delete relayProps.tooltip;
    delete relayProps.placement;

    return (
      <OverlayTrigger
        overlay={tooltip}
        placement={this.props.placement || 'bottom'}
        delayShow={300}
        delayHide={150}
      >
        <BootstrapNavItem {...relayProps}>{this.props.children}</BootstrapNavItem>
      </OverlayTrigger>
    );
  }
}

type FontAwesomeSize = 'lg' | '2x' | '3x' | '4x' | '5x';

/**
 * copied from the typings .d.ts file because this interface is not exported
 * 
 * @interface FontAwesomeProps
 */
export interface IFontAwesomeProps {

  border?: boolean;
  className?: string;
  fixedWidth?: boolean;
  flip?: 'horizontal' | 'vertical';
  inverse?: boolean;
  name: string;
  pulse?: boolean;
  rotate?: '90' | '180' | '270';
  spin?: boolean;
  stack?: string;
  style?: React.CSSProperties;
}

export type IIconProps = ITooltipProps & IFontAwesomeProps;
/**
 * Icon with a tooltip
 * 
 * @export
 * @class Icon
 */
export class Icon extends React.Component<IIconProps, {}> {
  public render(): JSX.Element {
    const tooltip = <Popover id={this.props.id}>{this.props.tooltip}</Popover>;
    let relayProps = Object.assign({}, this.props);
    delete relayProps.tooltip;
    delete relayProps.placement;

    return (
      <OverlayTrigger
        overlay={tooltip}
        placement={this.props.placement || 'bottom'}
        delayShow={300}
        delayHide={150}
      >
        <SvgIcon {...relayProps} />
      </OverlayTrigger>
    );
  }
}
