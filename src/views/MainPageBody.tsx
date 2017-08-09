import * as React from 'react';

class MainPageBody extends React.Component<React.HTMLAttributes<HTMLDivElement>, {}> {
  public render(): JSX.Element {
    return (
      <div className='main-page-body' {...this.props}>
        {this.props.children}
      </div>
    );
  }
}

export default MainPageBody;
