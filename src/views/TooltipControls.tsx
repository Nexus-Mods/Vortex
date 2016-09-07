import * as React from 'react';
import { Button as BootstrapButton, OverlayTrigger, Tooltip } from 'react-bootstrap';

interface IButtonProps {
    tooltip: string | React.Component<any, any>;
}

interface IButtonState {

}

export class Button extends React.Component<IButtonProps & ReactBootstrap.ButtonProps & ReactBootstrap.TooltipProps,
                                            IButtonState> {
    public render() {
        let tooltip = <Tooltip id={this.props.id}>{this.props.tooltip}</Tooltip>;
        let relayProps = Object.assign({}, this.props);
        delete relayProps.tooltip;
        delete relayProps.placement;

        return (
            <OverlayTrigger overlay={tooltip} placement={this.props.placement} delayShow={300} delayHide={150}>
                <BootstrapButton {...relayProps}>{this.props.children}</BootstrapButton>
            </OverlayTrigger>
        );
    }
}
