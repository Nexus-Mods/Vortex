import {PropsCallback} from '../../../types/IExtensionContext';
import { ComponentEx, extend, translate } from '../../../util/ComponentEx';

import PackeryGrid from './PackeryGrid';
import PackeryItem from './PackeryItem';

import * as React from 'react';

const UPDATE_FREQUENCY_MS = 200;

interface IDashletProps {
  title: string;
  width: 1 | 2 | 3;
  position: number;
  component: React.ComponentClass<any>;
  props?: PropsCallback;
  isVisible?: (state: any) => boolean;
}

interface IExtensionProps {
  objects: IDashletProps[];
}

type IProps = IExtensionProps;

interface IRenderedDash {
  props: IDashletProps;
  comp: JSX.Element;
}

/**
 * base layouter for the dashboard. No own content, just layouting
 */
class Dashboard extends ComponentEx<IProps, {}> {

  private mUpdateTimer: NodeJS.Timer;

  public componentDidMount() {
    this.startUpdateCycle();
  }

  public componentWillUnmount() {
    clearTimeout(this.mUpdateTimer);
  }

  public render(): JSX.Element {
    const { objects } = this.props;
    const state = this.context.api.store.getState();

    const sorted = objects
      .sort((lhs: IDashletProps, rhs: IDashletProps) => lhs.position - rhs.position)
      .filter((dash: IDashletProps) => (dash.isVisible === undefined) || dash.isVisible(state))
      ;

    return <PackeryGrid totalWidth={3}>
      {sorted.map(this.renderItem)}
    </PackeryGrid>;
  }

  private startUpdateCycle = () => {
    this.mUpdateTimer = setTimeout(() => {
      this.forceUpdate();
      this.startUpdateCycle();
    }, UPDATE_FREQUENCY_MS);
  }

  private renderItem = (dash: IDashletProps) => {
    const componentProps = dash.props !== undefined ? dash.props() : {};
    return <PackeryItem key={dash.title} width={dash.width}>
        <dash.component t={this.props.t} {...componentProps} />
      </PackeryItem>;
  }
}

function registerDashlet(instance: Dashboard,
                         title: string,
                         width: 1 | 2 | 3,
                         position: number,
                         component: React.ComponentClass<any>,
                         isVisible?: (state) => boolean,
                         props?: PropsCallback): IDashletProps {
  return { title, position, width, component, isVisible, props };
}

export default translate([ 'common' ], { wait: true })(
  extend(registerDashlet)(
    Dashboard
  )
) as React.ComponentClass<{}>;
