import Step from './Step';

import * as _ from 'lodash';
import * as React from 'react';

export interface IStepsProps {
  step: string;
}

export type IProps = React.HTMLAttributes<any> & IStepsProps;

class Steps extends React.Component<IProps, {}> {
  public static Step = Step;

  public render(): JSX.Element {
    const { step } = this.props;

    const childArray: Array<React.ReactElement<any>> =
      React.Children.toArray(this.props.children) as any[];

    const stepIdx = childArray
      .findIndex(child => child.props.stepId === step);

    const newChildren = childArray.reduce(
      (prev: Array<React.ReactElement<any>>, value: React.ReactElement<any>, idx: number) => {
        if (idx !== 0) {
          prev.push(<hr key={idx} />);
        }
        prev.push(React.cloneElement(value, {
          index: idx,
          state: this.classByIdx(stepIdx, idx),
        }));
        return prev;
    }, [] as any);
    return (<div className='steps' {..._.omit(this.props, ['step']) as any}>{newChildren}</div>);
  }

  private classByIdx(currentIdx: number, itemIdx: number) {
    return itemIdx < currentIdx
      ? 'done'
      : itemIdx === currentIdx
        ? 'current'
        : 'future';
    }
}

export interface ISteps extends React.ComponentClass<IProps> {
  Step: typeof Step;
}

export default Steps as ISteps;
