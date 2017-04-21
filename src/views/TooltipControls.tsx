import SvgIcon from './Icon';
import { ButtonType } from './IconBar';

import * as React from 'react';
import { Button as BootstrapButton, NavItem as BootstrapNavItem,
  OverlayTrigger, Popover,
} from 'react-bootstrap';

export interface ITooltipProps {
  tooltip: string | React.ReactElement<any>;
  id: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  buttonType?: ButtonType;
}

export type ButtonProps = ITooltipProps & typeof BootstrapButton.defaultProps;

/**
 * Button with a tooltip
 * 
 */
export class Button extends React.PureComponent<ButtonProps, {}> {
  public render() {
    let relayProps: any = Object.assign({}, this.props);
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
  spin?: boolean;
  pulse?: boolean;
  border?: boolean;
  inverse?: boolean;
  flip?: 'horizontal' | 'vertical';
  rotate?: '90' | '180' | '270';
}

const iconPropNames = new Set(['spin', 'pulse', 'border', 'inverse', 'flip', 'rotate']);

export type IconButtonProps = ButtonProps & IIconButtonExtraProps;

export class IconButton extends React.Component<IconButtonProps, {}> {
  public render() {
    let buttonProps = {};
    let iconProps = {};
    Object.keys(this.props).forEach(propKey => {
      if (['tooltip', 'placement', 'icon'].indexOf(propKey) !== -1) {
        return;
      }
      if (iconPropNames.has(propKey)) {
        iconProps[propKey] = this.props[propKey];
      } else {
        buttonProps[propKey] = this.props[propKey];
      }
    });

    if (typeof (this.props.tooltip) === 'string') {
      return (<BootstrapButton {...buttonProps} title={this.props.tooltip}>
        <SvgIcon name={this.props.icon} {...iconProps} />
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
          <BootstrapButton {...buttonProps}>
            <SvgIcon name={this.props.icon} {...iconProps} />
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
    const {state} = this.props;
    let relayProps = Object.assign({}, this.props);

    ['buttonType', 'tooltip', 'offTooltip', 'placement',
     'onIcon', 'offIcon', 'state'].forEach((prop) => {
      delete relayProps[prop];
    });

    const bType = this.props.buttonType || 'icon';
    const icon = state ? this.props.onIcon : this.props.offIcon;
    const tooltipText = state ? this.props.tooltip : this.props.offTooltip;

    if (typeof (tooltipText) === 'string') {
      return (<BootstrapButton {...relayProps} title={tooltipText}>
        { ['icon', 'both'].indexOf(bType) !== -1 ? <SvgIcon name={icon} /> : null }
        { ['text', 'both'].indexOf(bType) !== -1
          ? <p className='btn-toolbar-text'>{tooltipText}</p>
          : null }
        { this.props.children }
      </BootstrapButton>);
    } else {
      const tooltip = (
        <Popover id={this.props.id}>
          {tooltipText}
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
            { ['icon', 'both'].indexOf(bType) !== -1 ? <SvgIcon name={icon} /> : null }
            { ['text', 'both'].indexOf(bType) !== -1
              ? <p className='btn-toolbar-text'>{tooltipText}</p>
              : null }
            { this.props.children }
          </BootstrapButton>
        </OverlayTrigger>
      );
    }
  }
}

export type NavItemProps = ITooltipProps & typeof BootstrapNavItem.defaultProps;

export class NavItem extends React.Component<NavItemProps, {}> {
  public render() {
    let relayProps: any = Object.assign({}, this.props);
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
    let relayProps: any = Object.assign({}, this.props);
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
