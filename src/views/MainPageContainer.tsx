import { IMainPage } from '../types/IMainPage';
import { ComponentEx } from '../util/ComponentEx';

import * as PropTypes from 'prop-types';
import * as React from 'react';

export interface IBaseProps {
  page: IMainPage;
  active: boolean;
  overlayPortal: any;
  headerPortal: any;
}

export interface IMainPageContext {
  globalOverlay: JSX.Element;
}

type IProps = IBaseProps;

const nop = () => undefined;

class MainPageContainer extends ComponentEx<IBaseProps, {}> {
  public static childContextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
    headerPortal: PropTypes.object,
    overlayPortal: PropTypes.object,
    page: PropTypes.string,
  };

  public getChildContext() {
    const { active, headerPortal, overlayPortal, page } = this.props;
    return {
      api: this.context.api,
      overlayPortal,
      headerPortal,
      page: page.title,
    };
  }

  public render(): JSX.Element {
    const { active, page } = this.props;

    const props = page.propsFunc();

    return (
      <div className={`main-page ${active ? 'active' : 'hidden'}`}>
        <page.component active={active} {...props} />
      </div>
    );
  }
}

export default MainPageContainer;
