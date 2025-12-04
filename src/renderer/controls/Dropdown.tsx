import * as _ from 'lodash';
import * as React from 'react';
import { Dropdown } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';

export interface IBaseProps {
  container?: Element;
}

export type IProps = IBaseProps & typeof Dropdown.prototype.props;

export class DummyMenu extends React.Component<{}, {}> {
  public static defaultProps = {
    bsRole: (Dropdown.Menu as any).defaultProps.bsRole,
  };
  public render(): JSX.Element {
    return <div/>;
  }

  public focusNext() {
    // nop
  }
}

/**
 * An enhanced dropdown that adjusts placement of the popover based on the
 * position within the container, so it doesn't get cut off (as long as the
 * popover isn't larger than half of the container)
 *
 * @class MyDropdown
 * @extends {React.Component<IProps, { up: boolean }>}
 */
class MyDropdown extends React.Component<IProps, { up: boolean }> {
  public static Menu: typeof Dropdown.Menu = Dropdown.Menu;
  public static Toggle: typeof Dropdown.Toggle = Dropdown.Toggle;
  private mNode: Element;
  private mOpen: boolean = false;

  constructor(props: IProps) {
    super(props);

    this.state = {
      up: false,
    };
  }

  public componentDidMount() {
    this.mNode = ReactDOM.findDOMNode(this) as Element;
  }

  public render(): JSX.Element {
    const relayProps: any = _.omit(this.props, ['container', 'dropup', 'onToggle', 'children']);
    const filt = this.mOpen
      ? this.props.children
      : React.Children.map(this.props.children,
          child => (child as any).props.bsRole === 'menu' ? <DummyMenu /> : child);
    return (
      <Dropdown dropup={this.state.up} onToggle={this.onToggle} {...relayProps}>
        {filt}
      </Dropdown>
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
      const newUp = this.mNode.getBoundingClientRect().bottom > (bounds.top + bounds.height / 2);
      // force redraw to ensure the menu gets rendered too
      this.setState({ up: newUp });
    }

    if (this.props.onToggle) {
      this.props.onToggle.apply(this, [isOpen]);
    }
  }
}

export default MyDropdown;
