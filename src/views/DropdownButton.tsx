import * as _ from 'lodash';
import * as React from 'react';
import { DropdownButton } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';

interface IBaseProps {
  bounds: ClientRect;
}

type IProps = IBaseProps & ReactBootstrap.DropdownButtonProps;

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
    const relayProps: any = _.omit(this.props, ['bounds', 'dropup', 'onToggle']);
    return <DropdownButton dropup={this.state.up} onToggle={this.onToggle} {...relayProps} />;
  }

  private onToggle = (isOpen: boolean) => {
    if (isOpen) {
      const { bounds } = this.props;
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
