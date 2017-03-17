import SvgIcon from './Icon';

import * as React from 'react';
import { Button as BootstrapButton, NavItem as BootstrapNavItem,
         OverlayTrigger, Popover } from 'react-bootstrap';

export interface ITooltipProps {
  tooltip: string | React.ReactElement<any>;
  id: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
}

export type ButtonProps = ITooltipProps & typeof BootstrapButton.defaultProps;

/**
 * Button with a tooltip
 * 
 */
export class Button extends React.Component<ButtonProps, {}> {
  public render() {
    let relayProps = Object.assign({}, this.props);
    delete relayProps.tooltip;
    delete relayProps.placement;

    if (typeof (this.props.tooltip) === 'string') {
      return (<BootstrapButton {...relayProps} title={this.props.tooltip}>
        {this.props.children}
      </BootstrapButton>);
    } else {
      const tooltip = <Popover id={this.props.id}>{this.props.tooltip}</Popover>;
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
}

export interface IIconButtonExtraProps {
  icon: string;
}

export type IconButtonProps = ButtonProps & IIconButtonExtraProps;

export class IconButton extends React.Component<IconButtonProps, {}> {
  public render() {
    let relayProps = Object.assign({}, this.props);
    delete relayProps.tooltip;
    delete relayProps.placement;
    delete relayProps.icon;
    if (typeof (this.props.tooltip) === 'string') {
      return (<BootstrapButton {...relayProps} title={this.props.tooltip}>
        <SvgIcon name={this.props.icon} />
      </BootstrapButton>);
    } else {
      const tooltip = <Popover id={this.props.id}>{this.props.tooltip}</Popover>;
      return (
        <OverlayTrigger
          overlay={tooltip}
          placement={this.props.placement || 'bottom'}
          delayShow={300}
          delayHide={150}
        >
          <BootstrapButton {...relayProps}>
            <SvgIcon name={this.props.icon} />
          </BootstrapButton>
        </OverlayTrigger>
      );
    }
  }
}

export interface IToggleButtonExtraProps {
  onIcon: string;
  offIcon: string;
  offTooltip: string | React.Component<any, any>;
  state: boolean;
}

export type ToggleButtonProps = ButtonProps & IToggleButtonExtraProps;

export class ToggleButton extends React.Component<ToggleButtonProps, {}> {
  public render() {
    let relayProps = Object.assign({}, this.props);

    ['tooltip', 'offTooltip', 'placement', 'onIcon', 'offIcon', 'state'].forEach((prop) => {
      delete relayProps[prop];
    });

    if (typeof (this.props.tooltip) === 'string') {
      return (<BootstrapButton {...relayProps} title={this.props.tooltip}>
        <SvgIcon name={this.props.state ? this.props.onIcon : this.props.offIcon} />
      </BootstrapButton>);
    } else {
      const tooltip = (
        <Popover id={this.props.id}>
          {this.props.state ? this.props.tooltip : this.props.offTooltip}
        </Popover>
      );
      return (
        <OverlayTrigger
          overlay={tooltip}
          placement={this.props.placement || 'bottom'}
          delayShow={300}
          delayHide={150}
        >
          <BootstrapButton {...relayProps}>
            <SvgIcon name={this.props.state ? this.props.onIcon : this.props.offIcon} />
          </BootstrapButton>
        </OverlayTrigger>
      );
    }
  }
}

export type NavItemProps = ITooltipProps & typeof BootstrapNavItem.defaultProps;

export class NavItem extends React.Component<NavItemProps, {}> {
  public render() {
    let relayProps = Object.assign({}, this.props);
    delete relayProps.tooltip;
    delete relayProps.placement;

    if (typeof (this.props.tooltip) === 'string') {
      return <BootstrapNavItem {...relayProps} title={this.props.tooltip}>
        {this.props.children}
      </BootstrapNavItem>;
    } else {
      let tooltip = <Popover id={this.props.id}>{this.props.tooltip}</Popover>;
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

export type IconProps = ITooltipProps & IFontAwesomeProps;
/**
 * Icon with a tooltip
 * 
 * @export
 * @class Icon
 */
export class Icon extends React.Component<IconProps, {}> {
  public render() {
    let relayProps = Object.assign({}, this.props);
    delete relayProps.tooltip;
    delete relayProps.placement;

    if (typeof (this.props.tooltip) === 'string') {
      return <a className='fake-link' title={this.props.tooltip}>
        <SvgIcon {...relayProps} />
      </a>;
    } else {
      const tooltip = <Popover id={this.props.id}>{this.props.tooltip}</Popover>;

      return (
        <OverlayTrigger
          overlay={tooltip}
          placement={this.props.placement || 'bottom'}
          delayShow={300}
          delayHide={150}
        >
          <a className='fake-link'><SvgIcon {...relayProps} /></a>
        </OverlayTrigger>
      );
    }
  }
}
