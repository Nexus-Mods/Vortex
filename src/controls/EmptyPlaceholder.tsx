import Icon from './Icon';

import * as React from 'react';

export interface IEmptyPlaceholderProps {
  icon: string;
  text: string;
  subtext?: string;
  fill?: boolean;
}

function EmptyPlaceholder(props: IEmptyPlaceholderProps): JSX.Element {
  const classes = ['placeholder'];
  if (props.fill) {
    classes.push('fill-parent');
  }
  return (
    <div className={classes.join(' ')}>
      <Icon name={props.icon} />
      <div className='placeholder-text'>{props.text}</div>
      {
        props.subtext !== undefined
          ? <div className='placeholder-subtext'>{props.subtext}</div>
          : null
      }
    </div>
  );
}

export default EmptyPlaceholder;
