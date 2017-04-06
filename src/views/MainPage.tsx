import { IState } from '../types/IState';
import { ComponentEx, connect } from '../util/ComponentEx';

import Body from './MainPageBody';
import Overlay from './MainPageOverlay';

import * as React from 'react';

export interface IBaseProps {
}

interface IConnectedProps {
  overlayOpen: boolean;
}

type IProps = IBaseProps & IConnectedProps;

class MainPage extends ComponentEx<IProps, {}> {
  public static Body = Body;
  public static Overlay = Overlay;
  public static childContextTypes: React.ValidationMap<any> = {
    page: React.PropTypes.shape({
      overlayOpen: React.PropTypes.bool.isRequired,
    }),
  };

  public getChildContext() {
    return {
      page: {
        overlayOpen: this.props.overlayOpen,
      },
    };
  }

  public render(): JSX.Element {
    const { children } = this.props;
    return <div>
      {children}
    </div>;
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    overlayOpen: state.session.base.overlayOpen,
  };
}

export interface IMainPage extends React.ClassicComponentClass<{}> {
  Body: typeof Body;
  Overlay: typeof Overlay;
}

export default connect(mapStateToProps)(MainPage) as IMainPage;
