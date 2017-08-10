import { IMainPage } from '../types/IMainPage';
import { ComponentEx } from '../util/ComponentEx';

import * as PropTypes from 'prop-types';
import * as React from 'react';

export interface IBaseProps {
  page: IMainPage;
  active: boolean;
  secondary: boolean;
  overlayPortal: () => HTMLElement;
  headerPortal: () => HTMLElement;
}

export interface IMainPageContext {
  globalOverlay: JSX.Element;
}

type IProps = IBaseProps;

const nop = () => undefined;

class MainPageContainer extends ComponentEx<IBaseProps, {}> {
  public static childContextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
    headerPortal: PropTypes.func,
    overlayPortal: PropTypes.func,
    page: PropTypes.string,
  };

  public getChildContext() {
    const { active, headerPortal, overlayPortal, page } = this.props;
    return {
      api: this.context.api,
      overlayPortal: this.props.overlayPortal,
      headerPortal: this.props.headerPortal,
      page: page.title,
    };
  }

  public render(): JSX.Element {
    const { active, page, secondary } = this.props;

    const props = page.propsFunc();

    const classes = ['main-page'];
    classes.push(active ? 'active' : 'hidden');
    if (secondary) {
      classes.push('secondary');
    }

    return (
      <div className={classes.join(' ')}>
        <page.component active={active} secondary={secondary} {...props} />
      </div>
    );
  }
}

export default MainPageContainer;
