import { IMainPage } from '../types/IMainPage';

import * as React from 'react';

export interface IBaseProps {
  page: IMainPage;
  active: boolean;
  globalOverlay: JSX.Element;
}

export interface IMainPageContext {
  globalOverlay: JSX.Element;
}

type IProps = IBaseProps;

class MainPageContainer extends React.Component<IBaseProps, {}> {
  public render(): JSX.Element {
    const { active, globalOverlay, page } = this.props;

    const props = page.propsFunc();

    return <div className={`main-page main-page-${active ? 'active' : 'hidden'}`}>
      <page.component {...props} globalOverlay={globalOverlay} />
    </div>;
  }
}

export default MainPageContainer;
