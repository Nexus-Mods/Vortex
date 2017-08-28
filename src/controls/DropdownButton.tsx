import * as _ from 'lodash';
import * as React from 'react';
import { DropdownButton } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';

export interface IBaseProps {
  container?: Element;
}

export type IProps = IBaseProps & typeof DropdownButton.prototype.props;

/**
 * An enhanced dropdown button that adjusts placement of the popover based on the
 * position within the container, so it doesn't get cut off (as long as the
 * popover isn't larger than half of the container)
 *
 * @class MyDropdownButton
 * @extends {React.Component<IProps, { up: boolean }>}
 */
class MyDropdownButton extends React.Component<IProps, { up: boolean }> {
  private mNode: Element;

  constructor(props: IProps) {
    super(props);

    this.state = {
      up: false,
    };
  }

  public componentDidMount() {
    this.mNode = ReactDOM.findDOMNode(this);
  }

  public render(): JSX.Element {
    const relayProps: any = _.omit(this.props, ['container', 'dropup', 'onToggle']);
    return <DropdownButton dropup={this.state.up} onToggle={this.onToggle} {...relayProps} />;
  }

  private get bounds(): ClientRect {
    return this.props.container
      ? this.props.container.getBoundingClientRect()
      : {
        top: 0,
        left: 0,
        bottom: window.innerHeight,
        right: window.innerWidth,
        height: window.innerHeight,
        width: window.innerWidth,
      };
  }

  private onToggle = (isOpen: boolean) => {
    if (isOpen) {
      const bounds = this.bounds;
      const newUp = this.mNode.getBoundingClientRect().bottom > (bounds.top + bounds.height / 2);
      if (newUp !== this.state.up) {
        this.setState({ up: newUp });
      }
    }

    if (this.props.onToggle) {
      this.props.onToggle.apply(this, arguments);
    }
  }
}

export default MyDropdownButton;
