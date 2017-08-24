import * as _ from 'lodash';
import * as React from 'react';
import {Overlay} from 'react-bootstrap';
import * as ReactDOM from 'react-dom';

export interface IBaseProps {
  triggerRef?: (ref: HTMLElement) => void;
  getBounds: () => ClientRect;
  orientation: 'vertical' | 'horizontal';
  shouldUpdatePosition?: boolean;
}

export type IProps = IBaseProps & typeof Overlay.prototype.props;

/**
 * custom variant of the overlay that automatically chooses the placement
 * of the popover based on the position on the screen.
 *
 * This still uses an "orientation" of horizontal or vertical to pick the dimension
 * on which to move.
 *
 * The prop "getBounds" is used to retrieve the bounding rect used to determine the
 * placement. We can't use the container for this as the container may be a scrolling
 * control and not having to scroll to see the popover is the whole point of this.
 *
 * Right now the placement is only calculated when the popover is opened, it isn't updated
 * as a result of scrolling/resizing while the popover is open
 *
 * @class MyOverlayTrigger
 * @extends {React.Component<any, { placement: string }>}
 */
class MyOverlay extends React.Component<IProps, { placement: string }> {
  constructor(props) {
    super(props);

    this.state = {
      placement: props.orientation === 'horizontal' ? 'right' : 'bottom',
    };
  }

  public render() {
    const { placement } = this.state;
    const relayProps: any =
      _.omit(this.props, ['getBounds', 'placement', 'onEnter', 'triggerRef']);
    return (
      <Overlay
        placement={placement}
        onEnter={this.onEnter}
        ref={this.props.triggerRef}
        {...relayProps}
      >
        {this.props.children}
      </Overlay>
    );
  }

  private onEnter = (input: HTMLElement) => {
    const node = typeof this.props.target === 'function' ? this.props.target() : this.props.target;
    if (node) {
      const bounds: ClientRect = this.props.getBounds();
      if (this.props.orientation === 'horizontal') {
        const rightOfMid =
          node.getBoundingClientRect().left > bounds.left + bounds.width / 2;
        this.setState({
          placement: rightOfMid ? 'left' : 'right',
        });
      } else {
        const belowMid =
          node.getBoundingClientRect().top > bounds.top + bounds.height / 2;
        this.setState({
          placement: belowMid ? 'top' : 'bottom',
        });
      }
    }
    if (this.props.onEnter) {
      this.props.onEnter(input);
    }
  }
}

export default MyOverlay;
