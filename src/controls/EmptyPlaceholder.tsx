import Icon from './Icon';

import * as React from 'react';

export interface IEmptyPlaceholderProps {
  icon: string;
  text: string;
  subtext?: string | JSX.Element;
  fill?: boolean;
}

class EmptyPlaceholder extends React.PureComponent<IEmptyPlaceholderProps, {}> {
  constructor(props) {
    super(props);
  }

  public render(): JSX.Element {
    const { fill, icon, subtext, text } = this.props;
    const classes = ['placeholder'];
    if (fill) {
      classes.push('fill-parent');
    }
    return (
      <div className={classes.join(' ')}>
        <Icon className='placeholder-icon' name={icon} />
        <div className='placeholder-text'>{text}</div>
        {
          subtext !== undefined
            ? typeof (subtext) === 'string'
              ? <div className='placeholder-subtext'>{subtext}</div>
              : subtext
            : null
        }
      </div>
    );
  }
}

export default EmptyPlaceholder;
