import {PropsCallback} from '../../../types/IExtensionContext';
import { ComponentEx, extend, translate } from '../../../util/ComponentEx';
import MainPage from '../../../views/MainPage';

import PackeryGrid from './PackeryGrid';
import PackeryItem from './PackeryItem';

import * as React from 'react';
import * as ReactDOM from 'react-dom';

const UPDATE_FREQUENCY_MS = 1000;

interface IDashletProps {
  title: string;
  width: 1 | 2 | 3;
  height: 1 | 2 | 3;
  position: number;
  component: React.ComponentClass<any>;
  props?: PropsCallback;
  isVisible?: (state: any) => boolean;
}

interface IExtensionProps {
  objects: IDashletProps[];
}

type IProps = { active: boolean } & IExtensionProps;

interface IRenderedDash {
  props: IDashletProps;
  comp: JSX.Element;
}

/**
 * base layouter for the dashboard. No own content, just layouting
 */
class Dashboard extends ComponentEx<IProps, { counter: number }> {

  private mUpdateTimer: NodeJS.Timer;

  constructor(props: IProps) {
    super(props);

    this.initState({
      counter: 0,
    });
  }

  public componentDidMount() {
    this.startUpdateCycle();
  }

  public componentWillUnmount() {
    clearTimeout(this.mUpdateTimer);
  }

  public componentWillReceiveProps(nextProps: IProps) {
    if (this.props.active !== nextProps.active) {
      if (nextProps.active && (this.mUpdateTimer === undefined)) {
        this.startUpdateCycle();
      } else if (!nextProps.active && (this.mUpdateTimer !== undefined)) {
        clearTimeout(this.mUpdateTimer);
        this.mUpdateTimer = undefined;
      }
    }
  }

  public render(): JSX.Element {
    const { objects } = this.props;
    const state = this.context.api.store.getState();

    const sorted = objects
      .sort((lhs: IDashletProps, rhs: IDashletProps) => lhs.position - rhs.position)
      .filter((dash: IDashletProps) => (dash.isVisible === undefined) || dash.isVisible(state))
      ;

    return (
      <MainPage>
        <MainPage.Body style={{ height: '100%', overflowY: 'auto' }}>
          <PackeryGrid totalWidth={3}>
            {sorted.map(this.renderItem)}
          </PackeryGrid>
        </MainPage.Body>
      </MainPage>
    );
  }

  private startUpdateCycle = () => {
    // TODO: this is a hack needed so dashlets get updated even if they get props passed in
    //   in a way that doesn't properly signal for an update.
    this.mUpdateTimer = setTimeout(() => {
      this.nextState.counter++;
      this.startUpdateCycle();
    }, UPDATE_FREQUENCY_MS);
  }

  private renderItem = (dash: IDashletProps) => {
    const { counter } = this.state;
    const componentProps = dash.props !== undefined ? dash.props() : {};
    return (
      <PackeryItem key={dash.title} width={dash.width} height={dash.height}>
        <dash.component t={this.props.t} {...componentProps} counter={counter} />
      </PackeryItem>
    );
  }
}

function registerDashlet(instanceProps: IProps,
                         title: string,
                         width: 1 | 2 | 3,
                         height: 1 | 2 | 3,
                         position: number,
                         component: React.ComponentClass<any>,
                         isVisible?: (state) => boolean,
                         props?: PropsCallback): IDashletProps {
  return { title, position, width, height, component, isVisible, props };
}

export default translate([ 'common' ], { wait: true })(
  extend(registerDashlet)(
    Dashboard)) as React.ComponentClass<{}>;
