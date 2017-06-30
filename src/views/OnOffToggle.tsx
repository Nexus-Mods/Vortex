import Icon from './Icon';

import * as React from 'react';

export interface IBaseProps {
  value: boolean;
  onToggle: (newValue: boolean) => void;
}

type IProps = IBaseProps;

class OnOffToggle extends React.Component<IProps, {}> {
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
      </div>
    );
  }

  private toggle = () => {
    this.props.onToggle(!this.props.value);
  }
}

export default OnOffToggle;
