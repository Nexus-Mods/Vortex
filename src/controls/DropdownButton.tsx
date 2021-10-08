import * as _ from 'lodash';
import * as React from 'react';
import { DropdownButton, SplitButton } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';

export interface IBaseProps {
  split?: boolean;
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
class MyDropdownButton extends React.Component<IProps, { up: boolean, right: boolean }> {
  private mNode: Element;
  private mOpen: boolean = false;

  constructor(props: IProps) {
    super(props);

    this.state = {
      up: false,
      right: false,
    };
  }

  public componentDidMount() {
    this.mNode = ReactDOM.findDOMNode(this) as Element;
  }

  public render(): JSX.Element {
    const { up, right } = this.state;
    const relayProps: any =
      _.omit(this.props, ['container', 'dropup', 'onToggle', 'split', 'children']);
    const Comp: any = this.props.split ? SplitButton : DropdownButton;
    return (
      <Comp dropup={up} pullRight={right} onToggle={this.onToggle} {...relayProps}>
        {this.mOpen ? this.props.children : null}
      </Comp>
    );
  }

  private get bounds(): DOMRect {
    return this.props.container
      ? this.props.container.getBoundingClientRect()
      : {
        top: 0,
        left: 0,
        bottom: window.innerHeight,
        right: window.innerWidth,
        height: window.innerHeight,
        width: window.innerWidth,
      } as any;
  }

  private onToggle = (isOpen: boolean) => {
    this.mOpen = isOpen;
    if (isOpen) {
      const bounds = this.bounds;
      const nodeBounds = this.mNode.getBoundingClientRect();
      const newUp = nodeBounds.bottom > (bounds.top + bounds.height / 2);
      const newRight = nodeBounds.right > (bounds.left + bounds.width / 2);
      this.setState({ up: newUp, right: newRight });
    }

    if (this.props.onToggle) {
      this.props.onToggle.apply(this, isOpen);
    }
  }
}

export default MyDropdownButton;
