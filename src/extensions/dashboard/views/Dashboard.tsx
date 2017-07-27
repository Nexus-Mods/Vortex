import {PropsCallback} from '../../../types/IExtensionContext';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, extend, translate } from '../../../util/ComponentEx';
import Debouncer from '../../../util/Debouncer';
import MainPage from '../../../views/MainPage';

import { setLayout } from '../actions';

import PackeryGrid from './PackeryGrid';
import PackeryItem from './PackeryItem';

import * as _ from 'lodash';
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

interface IConnectedProps {
  layout: string[];
}

interface IActionProps {
  onSetLayout: (items: string[]) => void;
}

interface IExtensionProps {
  objects: IDashletProps[];
}

type IProps = { active: boolean } & IConnectedProps & IActionProps & IExtensionProps;

interface IRenderedDash {
  props: IDashletProps;
  comp: JSX.Element;
}

/**
 * base layouter for the dashboard. No own content, just layouting
 */
class Dashboard extends ComponentEx<IProps, { counter: number }> {
  private mUpdateTimer: NodeJS.Timer;
  private mLayoutDebouncer: Debouncer;

  constructor(props: IProps) {
    super(props);

    this.initState({
      counter: 0,
    });

    this.mLayoutDebouncer = new Debouncer((layout: string[]) => {
      if (!_.isEqual(layout, this.props.layout)) {
        this.props.onSetLayout(layout);
      }
      return null;
    }, 500);
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
    const { objects, layout } = this.props;
    const state = this.context.api.store.getState();

    const layoutMap: { [key: string]: number } = {};
    if (layout !== undefined) {
      layout.map((item: string, idx: number) => layoutMap[item] = idx - 1000);
    }

    const sorted = objects
      .sort((lhs: IDashletProps, rhs: IDashletProps) =>
        (layoutMap[lhs.title] || lhs.position) - (layoutMap[rhs.title] || rhs.position))
      .filter((dash: IDashletProps) => (dash.isVisible === undefined) || dash.isVisible(state))
      ;

    return (
      <MainPage>
        <MainPage.Body style={{ height: '100%', overflowY: 'auto' }}>
          <PackeryGrid totalWidth={3} onChangeLayout={this.onChangeLayout}>
            {sorted.map(this.renderItem)}
          </PackeryGrid>
        </MainPage.Body>
      </MainPage>
    );
  }

  private onChangeLayout = (layout: string[]) => {
    this.mLayoutDebouncer.schedule(undefined, layout);
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
      <PackeryItem id={dash.title} key={dash.title} width={dash.width} height={dash.height}>
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

function mapStateToProps(state: IState): IConnectedProps {
  return {
    layout: state.settings.interface.dashboardLayout,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetLayout: (items: string[]) => dispatch(setLayout(items)),
  };
}

export default translate([ 'common' ], { wait: true })(
  extend(registerDashlet)(
    connect(mapStateToProps, mapDispatchToProps)(
      Dashboard))) as React.ComponentClass<{}>;
