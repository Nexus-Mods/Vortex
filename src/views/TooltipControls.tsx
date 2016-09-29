import * as React from 'react';
import { Button as BootstrapButton, OverlayTrigger, Popover } from 'react-bootstrap';
import Fontawesome = require('react-fontawesome');

interface ITooltipProps {
  tooltip: string | React.Component<any, any>;
  id: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
}

type IButtonProps = ITooltipProps & ReactBootstrap.ButtonProps;

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

type FontAwesomeSize = 'lg' | '2x' | '3x' | '4x' | '5x';

/**
 * copied from the typings .d.ts file because this interface is not exported
 * 
 * @interface FontAwesomeProps
 */
interface IFontAwesomeProps {

  border?: boolean;
  className?: string;
  fixedWidth?: boolean;
  flip?: boolean;
  inverse?: boolean;
  name: string;
  pulse?: boolean;
  rotate?: number;
  size?: FontAwesomeSize;
  spin?: boolean;
  stack?: string;
  style?: React.CSSProperties;
}

type IIconProps = ITooltipProps & IFontAwesomeProps;
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
        <Fontawesome {...relayProps} />
      </OverlayTrigger>
    );
  }
}
