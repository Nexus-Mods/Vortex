import { truthy } from '../util/util';

import * as React from 'react';

export interface IDashletProps {
  className: string;
  title: string;
}

class Dashlet extends React.Component<IDashletProps, {}> {
  public render(): JSX.Element {
    const { className, title } = this.props;
    const classes = ['dashlet'].concat(className.split(' '));
    return (
      <div className={classes.join(' ')}>
        {truthy(title) ? <div className='dashlet-title'>{title}</div> : null}
        {this.props.children}
      </div>
    );
  }
}

export default Dashlet;
