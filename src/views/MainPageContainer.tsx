import ExtensionGate from '../controls/ExtensionGate';
import Icon from '../controls/Icon';
import { IMainPage } from '../types/IMainPage';
import { ComponentEx, translate } from '../util/ComponentEx';
import { didIgnoreError, isOutdated } from '../util/errorHandling';
import { genHash } from '../util/genHash';
import { log } from '../util/log';

import { remote } from 'electron';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Alert, Button, Jumbotron } from 'react-bootstrap';
import { WithTranslation } from 'react-i18next';

export interface IBaseProps {
  page: IMainPage;
  active: boolean;
  secondary: boolean;
}

export interface IMainPageContext {
  globalOverlay: JSX.Element;
}

type IProps = IBaseProps & WithTranslation;

interface IComponentState {
  error: Error;
  errorInfo: React.ErrorInfo;
}

class MainPageContainer extends ComponentEx<IProps, IComponentState> {
  public static childContextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
    headerPortal: PropTypes.func,
    page: PropTypes.string,
  };

  private headerRef: HTMLElement;

  constructor(props: IProps) {
    super(props);

    this.state = {
      error: undefined,
      errorInfo: undefined,
    };
  }

  public getChildContext() {
    const { page } = this.props;
    return {
      api: this.context.api,
      headerPortal: () => this.headerRef,
      page: page.id,
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
        <div id={`page-${page.id}`} className={classes.join(' ')}>
          <Alert className='render-failure' bsStyle='danger'>
            <Icon className='render-failure-icon' name='sad' />
            <div className='render-failure-text'>{t('Failed to render.')}</div>
            <div className='render-failure-buttons'>
              {(isOutdated() || didIgnoreError())
                ? null : <Button onClick={this.report}>{t('Report')}</Button>}
              <Button onClick={this.retryRender}>{t('Retry')}</Button>
            </div>
          </Alert>
        </div>
      );
    }

    try {
      const props = page.propsFunc();

      return (
        <div id={`page-${page.id}`} className={classes.join(' ')}>
          <div className='mainpage-header-container' ref={this.setHeaderRef} />
          <div className='mainpage-body-container'>
            <ExtensionGate id={page.id}>
              <page.component active={active} secondary={secondary} {...props} />
            </ExtensionGate>
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
    events.emit('report-feedback', error.stack.split('\n')[0], `Component rendering error

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
    if (this.headerRef !== ref) {
      this.headerRef = ref;
      this.forceUpdate();
    }
  }
}

export default translate(['common'])(MainPageContainer);
