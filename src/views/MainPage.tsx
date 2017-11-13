import { ComponentEx } from '../util/ComponentEx';

import Body from './MainPageBody';
import Header from './MainPageHeader';
import Overlay from './MainPageOverlay';

import * as React from 'react';

export interface IBaseProps {
  id?: string;
  className?: string;
  domRef?: (ref: HTMLElement) => void;
}

type IProps = IBaseProps;

class MainPage extends ComponentEx<IProps, {}> {
  public static Body = Body;
  public static Header = Header;
  public static Overlay = Overlay;

  public render(): JSX.Element {
    const { children, className, domRef, id } = this.props;
    return (
      <div id={id} ref={domRef} className={(className || '') + ' main-page-inner'}>
        {children}
      </div>
    );
  }
}

export interface IMainPage extends React.ComponentClass<IBaseProps> {
  Body: typeof Body;
  Overlay: typeof Overlay;
  Header: typeof Header;
}

export default MainPage as IMainPage;
