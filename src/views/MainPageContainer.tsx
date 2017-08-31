import { IMainPage } from '../types/IMainPage';
import { ComponentEx, translate } from '../util/ComponentEx';
import { log } from '../util/log';

import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Jumbotron } from 'react-bootstrap';

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
    const { t, active, page, secondary } = this.props;

    const classes = ['main-page'];
    classes.push(active ? 'page-active' : 'page-hidden');
    if (secondary) {
      classes.push('secondary');
    }

    try {
      const props = page.propsFunc();

      return (
        <div className={classes.join(' ')}>
          <page.component active={active} secondary={secondary} {...props} />
        </div>
      );
    } catch (err) {
      log('warn', 'error rendering extension main page', { err: err.message });
      return (
        <div className={classes.join(' ')}>
          <Jumbotron><h4>{t('Unavailable')}</h4></Jumbotron>
        </div>
      );
    }
  }
}

export default translate(['common'], { wait: false })(MainPageContainer);
