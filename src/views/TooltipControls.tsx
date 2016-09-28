import * as React from 'react';
import { Button as BootstrapButton, OverlayTrigger, Tooltip } from 'react-bootstrap';

interface IButtonProps {
  tooltip: string | React.Component<any, any>;
}

type IProps = IButtonProps & ReactBootstrap.ButtonProps & ReactBootstrap.TooltipProps;

export class Button extends React.Component<IProps, {}> {
  public render() {
    let tooltip = <Tooltip id={this.props.id}>{this.props.tooltip}</Tooltip>;
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
