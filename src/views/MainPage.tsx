import { ComponentEx } from '../util/ComponentEx';

import Body from './MainPageBody';
import Overlay from './MainPageOverlay';

import * as React from 'react';

export interface IBaseProps {
}

type IProps = IBaseProps;

class MainPage extends ComponentEx<IProps, {}> {
  public static Body = Body;
  public static Overlay = Overlay;

  public render(): JSX.Element {
    const { children } = this.props;
    return <div>
      {children}
    </div>;
  }
}

export interface IMainPage extends React.ComponentClass<{}> {
  Body: typeof Body;
  Overlay: typeof Overlay;
}

export default MainPage as IMainPage;
