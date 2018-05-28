import FlexLayout from '../controls/FlexLayout';
import Icon from '../controls/Icon';
import { IMainPage } from '../types/IMainPage';
import { ComponentEx, translate } from '../util/ComponentEx';
import { genHash } from '../util/errorHandling';
import { log } from '../util/log';

import { remote } from 'electron';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Alert, Button, Jumbotron } from 'react-bootstrap';

export interface IBaseProps {
  page: IMainPage;
  active: boolean;
  secondary: boolean;
}

export interface IMainPageContext {
  globalOverlay: JSX.Element;
}

type IProps = IBaseProps;

interface IComponentState {
  error: Error;
  errorInfo: React.ErrorInfo;
}

const nop = () => undefined;

class MainPageContainer extends ComponentEx<IBaseProps, IComponentState> {
  public static childContextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
    headerPortal: PropTypes.func,
    page: PropTypes.string,
  };

  private headerRef: HTMLElement;

  constructor(props: IBaseProps) {
    super(props);

    this.state = {
      error: undefined,
      errorInfo: undefined,
    };
  }

  public getChildContext() {
    const { active, page } = this.props;
    return {
      api: this.context.api,
      headerPortal: () => this.headerRef,
      page: page.title,
    };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
  }

  public render(): JSX.Element {
    const { t, active, page, secondary } = this.props;
    const { error } = this.state;

    const classes = ['main-page'];
    classes.push(active ? 'page-active' : 'page-hidden');
    if (secondary) {
      classes.push('secondary');
    }

    if (error !== undefined) {
      return (
        <div className={classes.join(' ')}>
          <Alert className='render-failure' bsStyle='danger'>
            <Icon className='render-failure-icon' name='sad' />
            <div className='render-failure-text'>{t('Failed to render.')}</div>
            <div className='render-failure-buttons'>
              <Button onClick={this.report}>{t('Report')}</Button>
              <Button onClick={this.retryRender}>{t('Retry')}</Button>
            </div>
          </Alert>
        </div>
      );
    }

    try {
      const props = page.propsFunc();

      return (
        <div className={classes.join(' ')}>
          <div className='mainpage-header-container' ref={this.setHeaderRef} />
          <div className='mainpage-body-container'>
            <page.component active={active} secondary={secondary} {...props} />
          </div>
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

  private report = () => {
    const { events } = this.context.api;
    const { error, errorInfo } = this.state;
    events.emit('report-feedback', `Component rendering error

Vortex Version: ${remote.app.getVersion()},

${error.stack}

ComponentStack:
  ${errorInfo.componentStack}
`, [], genHash(error));
  }

  private retryRender = () => {
    this.setState({ error: undefined, errorInfo: undefined });
  }

  private setHeaderRef = ref => {
    this.headerRef = ref;
  }
}

export default translate(['common'], { wait: false })(MainPageContainer);
