import * as React from 'react';

class MainPageBody extends React.Component<React.HTMLAttributes<HTMLDivElement>, {}> {
  public render(): JSX.Element {
    return (
      <div {...this.props}>
        {this.props.children}
      </div>
    );
  }
}

export default MainPageBody;
