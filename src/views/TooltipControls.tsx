import SvgIcon from './Icon';

import * as React from 'react';
import { Button as BootstrapButton, NavItem as BootstrapNavItem,
         OverlayTrigger, Popover } from 'react-bootstrap';

export interface ITooltipProps {
  tooltip: string | React.Component<any, any>;
  id: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
}

export type ButtonProps = ITooltipProps & typeof BootstrapButton.defaultProps;

/**
 * Button with a tooltip
 * 
 */
export const Button = (props: ButtonProps) => {
  let tooltip = <Popover id={props.id}>{props.tooltip}</Popover>;
  let relayProps = Object.assign({}, props);
  delete relayProps.tooltip;
  delete relayProps.placement;

  return (
    <OverlayTrigger
      overlay={tooltip}
      placement={props.placement || 'bottom'}
      delayShow={300}
      delayHide={150}
    >
      <BootstrapButton {...relayProps}>{props.children}</BootstrapButton>
    </OverlayTrigger>
  );
};

export interface IIconButtonExtraProps {
  icon: string;
}

export type IconButtonProps = ButtonProps & IIconButtonExtraProps;

export const IconButton = (props: IconButtonProps) => {
  let tooltip = <Popover id={props.id}>{props.tooltip}</Popover>;
  let relayProps = Object.assign({}, props);
  delete relayProps.tooltip;
  delete relayProps.placement;
  delete relayProps.icon;

  return (
    <OverlayTrigger
      overlay={tooltip}
      placement={props.placement || 'bottom'}
      delayShow={300}
      delayHide={150}
    >
      <BootstrapButton {...relayProps}>
        <SvgIcon name={props.icon} />
      </BootstrapButton>
    </OverlayTrigger>
  );
};

export interface IToggleButtonExtraProps {
  onIcon: string;
  offIcon: string;
  offTooltip: string | React.Component<any, any>;
  state: boolean;
}

export type ToggleButtonProps = ButtonProps & IToggleButtonExtraProps;

export const ToggleButton = (props: ToggleButtonProps) => {
  let tooltip = (
    <Popover id={props.id}>
      {props.state ? props.tooltip : props.offTooltip}
    </Popover>
  );
  let relayProps = Object.assign({}, props);

  ['tooltip', 'offTooltip', 'placement', 'onIcon', 'offIcon', 'state'].forEach((prop) => {
    delete relayProps[prop];
  });

  return (
    <OverlayTrigger
      overlay={tooltip}
      placement={props.placement || 'bottom'}
      delayShow={300}
      delayHide={150}
    >
      <BootstrapButton {...relayProps}>
        <SvgIcon name={props.state ? props.onIcon : props.offIcon} />
      </BootstrapButton>
    </OverlayTrigger>
  );
};

export type NavItemProps = ITooltipProps & typeof BootstrapNavItem.defaultProps;

export const NavItem = (props: NavItemProps) => {
  let tooltip = <Popover id={props.id}>{props.tooltip}</Popover>;
  let relayProps = Object.assign({}, props);
  delete relayProps.tooltip;
  delete relayProps.placement;

  return (
    <OverlayTrigger
      overlay={tooltip}
      placement={props.placement || 'bottom'}
      delayShow={300}
      delayHide={150}
    >
      <BootstrapNavItem {...relayProps}>{props.children}</BootstrapNavItem>
    </OverlayTrigger>
  );
};

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
export const Icon = (props: IconProps) => {
  const tooltip = <Popover id={props.id}>{props.tooltip}</Popover>;
  let relayProps = Object.assign({}, props);
  delete relayProps.tooltip;
  delete relayProps.placement;

  return (
    <OverlayTrigger
      overlay={tooltip}
      placement={props.placement || 'bottom'}
      delayShow={300}
      delayHide={150}
    >
      <a className='fake-link'><SvgIcon {...relayProps} /></a>
    </OverlayTrigger>
  );
};
