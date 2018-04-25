import { IDashletSettings, IState } from '../../../types/IState';
import { ComponentEx, connect, extend, translate } from '../../../util/ComponentEx';
import Debouncer from '../../../util/Debouncer';
import MainPage from '../../../views/MainPage';

import { setDashletEnabled, setLayout } from '../actions';

import PackeryGrid from './PackeryGrid';
import PackeryItem from './PackeryItem';

import { remote } from 'electron';
import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Redux from 'redux';
import { getSafe } from '../../../util/storeHelper';
import { IDashletProps } from '../types/IDashletProps';

const UPDATE_FREQUENCY_MS = 1000;

interface IBaseProps {
  active: boolean;
  dashlets: IDashletProps[];
}

interface IConnectedProps {
  layout: string[];
  dashletSettings: { [dashletId: string]: IDashletSettings };
}

interface IActionProps {
  onSetLayout: (items: string[]) => void;
  onSetDashletEnabled: (dashletId: string, enabled: boolean) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IRenderedDash {
  props: IDashletProps;
  comp: JSX.Element;
}

interface IComponentState {
  counter: number;
}

/**
 * base layouter for the dashboard. No own content, just layouting
 */
class Dashboard extends ComponentEx<IProps, IComponentState> {
  private mUpdateTimer: NodeJS.Timer;
  private mLayoutDebouncer: Debouncer;
  private mWindowFocused: boolean = true;

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
    // assuming this doesn't change?
    const window = remote.getCurrentWindow();
    this.mWindowFocused = window.isFocused();
    window.on('focus', () => { this.mWindowFocused = true; });
    window.on('blur', () => { this.mWindowFocused = false; });
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
    const { dashletSettings, layout, dashlets } = this.props;

    const state = this.context.api.store.getState();

    const layoutMap: { [key: string]: number } = {};
    if (layout !== undefined) {
      layout.forEach((item: string, idx: number) => layoutMap[item] = idx + 1000);
    }

    const sorted = dashlets
      .filter((dash: IDashletProps) =>
        ((dash.isVisible === undefined) || dash.isVisible(state))
        && getSafe(dashletSettings, [dash.title, 'enabled'], true))
      .sort((lhs: IDashletProps, rhs: IDashletProps) =>
        (layoutMap[lhs.title] || lhs.position) - (layoutMap[rhs.title] || rhs.position))
      ;

    const fixed = sorted.filter(dash => dash.fixed);
    const dynamic = sorted.filter(dash => !dash.fixed);

    return (
      <MainPage id='page-dashboard' className='page-dashboard'>
        <MainPage.Body
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <div className='fixed-dashlets'>
            {fixed.map(this.renderFixedItem)}
          </div>
          <div className='dynamic-dashlets'>
            <PackeryGrid totalWidth={3} onChangeLayout={this.onChangeLayout}>
              {dynamic.map(this.renderItem)}
            </PackeryGrid>
          </div>
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
    //   it should be possible to make this unnecessary with makeReactive, but that requires
    //   testing

    this.mUpdateTimer = setTimeout(() => {
      if (this.mWindowFocused) {
        this.nextState.counter++;
      }
      this.startUpdateCycle();
    }, UPDATE_FREQUENCY_MS);
  }

  private renderFixedItem = (dash: IDashletProps) => {
    const { counter } = this.state;
    const componentProps = dash.props !== undefined ? dash.props() : {};

    return (
      <div className={`fixed-width-${dash.width} packery-height-${dash.height}`} key={dash.title}>
        <dash.component t={this.props.t} {...componentProps} counter={counter} />
      </div>
    );
  }

  private renderItem = (dash: IDashletProps) => {
    const { counter } = this.state;
    const componentProps = dash.props !== undefined ? dash.props() : {};
    return (
      <PackeryItem
        id={dash.title}
        key={dash.title}
        width={dash.width}
        height={dash.height}
        onDismiss={dash.closable ? this.dismissDashlet : undefined}
        fixed={dash.fixed}
      >
        <dash.component t={this.props.t} {...componentProps} counter={counter} />
      </PackeryItem>
    );
  }

  private dismissDashlet = (dashletId: string) => {
    this.props.onSetDashletEnabled(dashletId, false);
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    layout: state.settings.interface.dashboardLayout,
    dashletSettings: state.settings.interface.dashletSettings,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetLayout: (items: string[]) => dispatch(setLayout(items)),
    onSetDashletEnabled: (dashletId: string, enabled: boolean) =>
      dispatch(setDashletEnabled(dashletId, enabled)),
  };
}

export default translate([ 'common' ], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(
      Dashboard)) as React.ComponentClass<{}>;
