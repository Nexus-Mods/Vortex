import * as React from 'react';

class MainPageBody extends React.Component<{}, {}> {
  public render(): JSX.Element {
    return <div>
      {this.props.children}
    </div>;
  }
}

export default MainPageBody;
