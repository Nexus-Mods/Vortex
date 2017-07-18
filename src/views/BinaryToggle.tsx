import Icon from './Icon';

import * as React from 'react';

export interface IProps {
  value: boolean;
  onToggle: (newValue: boolean) => void;
}

class BinaryToggle extends React.Component<IProps, {}> {
  constructor(props: IProps) {
    super(props);
  }

  public render(): JSX.Element {
    const { value } = this.props;
    return (
      <div onClick={this.toggle} style={{ display: 'inline-block' }}>
        <Icon
          className={`button-toggle ${value ? 'on' : 'off'}`}
          name={`toggle-${value ? 'on' : 'off'}`}
        />
        {this.props.children}
      </div>
    );
  }

  private toggle = () => {
    this.props.onToggle(!this.props.value);
  }
}

export default BinaryToggle;
