import * as React from 'react';

interface IDashletProps {
  className: string;
  title: string;
}

class Dashlet extends React.Component<IDashletProps, {}> {
  public render(): JSX.Element {
    const { className, title } = this.props;
    const classes = ['dashlet'].concat(className.split(' '));
    return (
      <div className={classes.join(' ')}>
        <h3>{title}</h3>
        {this.props.children}
      </div>
    );
  }
}

export default Dashlet;
