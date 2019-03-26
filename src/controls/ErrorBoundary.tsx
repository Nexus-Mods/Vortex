import { ComponentEx } from '../util/ComponentEx';
import { isOutdated, didIgnoreError } from '../util/errorHandling';
import { genHash } from '../util/genHash';

import Icon from './Icon';
import { IconButton } from './TooltipControls';

import { remote } from 'electron';
import * as I18next from 'i18next';
import * as React from 'react';
import { Alert, Button } from 'react-bootstrap';
import { translate } from 'react-i18next';

export interface IErrorBoundaryProps {
  visible?: boolean;
  onHide?: () => void;
  className?: string;
}

interface IErrorBoundaryState {
  error: Error;
  errorInfo: React.ErrorInfo;
}

class ErrorBoundary extends ComponentEx<IErrorBoundaryProps, IErrorBoundaryState> {
  constructor(props: IErrorBoundaryProps) {
    super(props);

    this.state = {
      error: undefined,
      errorInfo: undefined,
    };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
  }

  public render(): JSX.Element {
    const { t, className, onHide, visible } = this.props;
    const { error } = this.state;

    if (error === undefined) {
      return React.Children.only(this.props.children);
    }

    const classes = (className || '').split(' ');
    classes.push('errorboundary');

    return visible ? (
      <div className={classes.join(' ')}>
        <Alert className='render-failure' bsStyle='danger'>
          <Icon className='render-failure-icon' name='sad' />
          <div className='render-failure-text'>{t('Failed to render.')}</div>
          <div className='render-failure-buttons'>
            {(isOutdated() || didIgnoreError()) ? null : <Button onClick={this.report}>{t('Report')}</Button>}
            <Button onClick={this.retryRender}>{t('Retry')}</Button>
          </div>
          {(onHide !== undefined)
            ? (
              <IconButton
                className='error-boundary-close'
                tooltip={t('Hide')}
                icon='close'
                onClick={onHide}
              />)
              : null}
        </Alert>
      </div>
      ) : null;
  }

  private report = () => {
    const { events } = this.context.api;
    const { onHide } = this.props;
    const { error, errorInfo } = this.state;
    if (onHide !== undefined) {
      onHide();
    }
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

}

export default translate(['common'], {})(ErrorBoundary);
