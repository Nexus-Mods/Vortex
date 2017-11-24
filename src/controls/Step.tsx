import Icon from './Icon';

import * as React from 'react';

export interface IStepProps {
  stepId: string;
  title: string;
  description: string;
  index?: number;
  state?: 'done' | 'current' | 'future';
}

class Step extends React.Component<IStepProps, {}> {
  public render(): JSX.Element {
    const { description, index, state, title } = this.props;
    return (
      <div className={`steps-step ${state}`}>
        <div className='steps-step-number'>
          {state === 'done' ? <Icon name='feedback-success'/> : index + 1}
        </div>
        <div className='steps-step-main'>
          <div className='steps-step-title'>{title}</div>
        </div>
      </div>
    );
  }
}

export default Step;
