import * as React from 'react';
import * as ReactDOM from 'react-dom';
import Select, { ReactSelectProps } from 'react-select';

export interface ISelectUpDownProps {
  container?: Element;
  className?: string;
}

interface ISelectUpDownState {
  up: boolean;
}

type IProps = ISelectUpDownProps & ReactSelectProps;

class SelectUpDown extends React.Component<IProps, ISelectUpDownState> {
  private mNode: Element = null;

  public constructor(props: IProps) {
    super(props);

    this.state = {
      up: false,
    };
  }

  public componentDidMount() {
    this.mNode = ReactDOM.findDOMNode(this) as Element;
  }

  public render(): JSX.Element {
    const classes = ['select-up-down'];
    if (this.props.className) {
      classes.push(...this.props.className.split(' '));
    }
    if (this.state.up) {
      classes.push('select-up-down-up');
    }
    return (
      <Select {...this.props} className={classes.join(' ')} onOpen={this.onMenuOpen} />
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

  private onMenuOpen = () => {
    const bounds = this.bounds;
    const newUp = this.mNode.getBoundingClientRect().bottom > (bounds.top + bounds.height / 2);
    // force redraw to ensure the menu gets rendered too
    this.setState({ up: newUp });
    if (this.props.onOpen !== undefined) {
      this.props.onOpen.apply(this);
    }
  }
}

export default SelectUpDown;
