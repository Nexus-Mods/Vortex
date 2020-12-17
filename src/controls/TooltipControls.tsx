import SvgIcon from './Icon';
import { ButtonType } from './IconBar';

import update from 'immutability-helper';
import * as _ from 'lodash';
import * as React from 'react';

import { Button as BootstrapButton, NavItem as BootstrapNavItem,
  Overlay, OverlayTrigger, Popover,
} from 'react-bootstrap';

export interface ITooltipProps {
  tooltip: string | React.ReactElement<any>;
  id?: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  buttonType?: ButtonType;
}

export type ButtonProps = ITooltipProps & typeof BootstrapButton.prototype.props;

/**
 * Button with a tooltip
 *
 */
export class Button extends React.PureComponent<ButtonProps, {}> {
  public render() {
    const { tooltip } = this.props;
    const relayProps: any = { ...this.props };
    delete relayProps.tooltip;
    delete relayProps.placement;

    if ((tooltip === undefined) || (typeof (this.props.tooltip) === 'string')) {
      return (
        <BootstrapButton {...relayProps} title={this.props.tooltip}>
          {this.props.children}
        </BootstrapButton>
      );
    } else {
      const tooltipCtrl = <Popover id={this.props.id}>{this.props.tooltip}</Popover>;
      return (
        <OverlayTrigger
          overlay={tooltipCtrl}
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
  stroke?: boolean;
  hollow?: boolean;
  border?: boolean;
  inverse?: boolean;
  flip?: 'horizontal' | 'vertical';
  rotate?: number;
  rotateId?: string;
  vertical?: boolean;
}

const iconPropNames = new Set(['spin', 'pulse', 'stroke', 'hollow', 'border', 'inverse',
                               'flip', 'rotate', 'rotateId', 'vertical']);

export type IconButtonProps = ButtonProps & IIconButtonExtraProps;

export class IconButton extends React.Component<IconButtonProps, {}> {
  public render() {
    const buttonProps = {};
    const iconProps = {};
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

    if (buttonProps['className'] !== undefined) {
      buttonProps['className'] += ' icon-button';
    } else {
      buttonProps['className'] = 'icon-button';
    }

    if (React.Children.count(this.props.children) > 0) {
      buttonProps['className'] += ' has-children';
    }

    if (this.props.vertical) {
      buttonProps['className'] += ' icon-button-vertical';
    } else {
      buttonProps['className'] += ' icon-button-horizontal';
    }

    if (this.props.tooltip === undefined) {
      return (
        <BootstrapButton {...buttonProps}>
          <SvgIcon name={this.props.icon} {...iconProps} />
          {this.props.children}
        </BootstrapButton>
      );
    } else if (typeof (this.props.tooltip) === 'string') {
      return (
        <BootstrapButton {...buttonProps} title={this.props.tooltip}>
          <SvgIcon name={this.props.icon} {...iconProps} />
          {this.props.children}
        </BootstrapButton>
      );
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
            {this.props.children}
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
    const relayProps = { ...this.props };

    ['buttonType', 'tooltip', 'offTooltip', 'placement',
     'onIcon', 'offIcon', 'state'].forEach((prop) => {
      delete relayProps[prop];
    });

    const bType = this.props.buttonType || 'icon';
    const icon = state ? this.props.onIcon : this.props.offIcon;
    const tooltipText = state ? this.props.tooltip : this.props.offTooltip;

    if (typeof (tooltipText) === 'string') {
      return (
        <BootstrapButton {...relayProps as any} title={tooltipText}>
          {['icon', 'both'].indexOf(bType) !== -1 ? <SvgIcon name={icon} /> : null}
          {['text', 'both'].indexOf(bType) !== -1
            ? <p className='button-text'>{tooltipText}</p>
            : null}
          {this.props.children}
        </BootstrapButton>
      );
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
          <BootstrapButton {...relayProps as any}>
            {['icon', 'both'].indexOf(bType) !== -1 ? <SvgIcon name={icon} /> : null}
            {['text', 'both'].indexOf(bType) !== -1
              ? <p className='button-text'>{tooltipText}</p>
              : null}
            {this.props.children}
          </BootstrapButton>
        </OverlayTrigger>
      );
    }
  }
}

export type NavItemProps = ITooltipProps & typeof BootstrapNavItem.prototype.props;

export class NavItem extends React.Component<NavItemProps, {}> {
  public render() {
    const relayProps: any = { ...this.props };
    delete relayProps.tooltip;
    delete relayProps.placement;

    if (typeof (this.props.tooltip) === 'string') {
      return (
        <BootstrapNavItem {...relayProps} title={this.props.tooltip}>
          {this.props.children}
        </BootstrapNavItem>
      );
    } else {
      const tooltip = <Popover id={this.props.id}>{this.props.tooltip}</Popover>;
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
export interface ITooltipIconProps {
  border?: boolean;
  className?: string;
  fixedWidth?: boolean;
  flip?: 'horizontal' | 'vertical';
  inverse?: boolean;
  name: string;
  set?: string;
  pulse?: boolean;
  rotate?: '90' | '180' | '270';
  rotateId?: string;
  spin?: boolean;
  stack?: string;
  stroke?: boolean;
  hollow?: boolean;
  style?: React.CSSProperties;
}

export type IconProps = ITooltipProps & ITooltipIconProps;
/**
 * Icon with a tooltip
 *
 * @export
 * @class Icon
 */
export class Icon extends React.Component<IconProps, {}> {
  public render() {
    const relayProps: any = _.omit(this.props, ['tooltip', 'placement']);

    const classes = ['fake-link'].concat((this.props.className || '').split(' '));

    if (typeof (this.props.tooltip) === 'string') {
      return (
        <a className={classes.join(' ')} title={this.props.tooltip}>
          <SvgIcon {...relayProps} />
        </a>
      );
    } else {
      const tooltip = <Popover id={this.props.id}>{this.props.tooltip}</Popover>;

      return (
        <OverlayTrigger
          overlay={tooltip}
          placement={this.props.placement || 'bottom'}
          delayShow={300}
          delayHide={150}
        >
          <a className={classes.join(' ')}><SvgIcon {...relayProps} /></a>
        </OverlayTrigger>
      );
    }
  }
}

export type ClickPopoverProps = ButtonProps & IIconButtonExtraProps & {
};

export class ClickPopover extends React.Component<ClickPopoverProps, { open: boolean }> {
  private mRef: JSX.Element;

  constructor(props: ClickPopoverProps) {
    super(props);
    this.state = {
      open: false,
    };
  }

  public render(): JSX.Element {
    const { className, children, icon, id, tooltip } = this.props;
    const popover = (
      <Popover id={`popover-${id}`} style={{ maxWidth: 500 }}>
        {children}
      </Popover>
    );

    return (
      <div style={{ display: 'inline' }}>
        <IconButton
          id={`btn-${id}`}
          className={className}
          tooltip={tooltip}
          icon={icon}
          ref={this.setRef}
          onClick={this.toggleOverlay}
        />
        <Overlay
          show={this.state.open}
          onHide={this.hideOverlay}
          placement='left'
          rootClose={true}
          target={this.mRef as any}
        >
          {popover}
        </Overlay>
      </div>);
  }

  private toggleOverlay = () => {
    this.setState(update(this.state, { open: { $set: !this.state.open } }));
  }

  private hideOverlay = () => {
    this.setState(update(this.state, { open: { $set: false } }));
  }

  private setRef = (ref) => {
    this.mRef = ref;
  }
}
