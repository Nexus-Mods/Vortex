import Icon from '../../../controls/Icon';
import Webview from '../../../controls/Webview';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import * as fs from '../../../util/fs';
import {log} from '../../../util/log';
import MainPage from '../../../views/MainPage';

import { closeBrowser } from '../actions';

import { remote } from 'electron';
import * as path from 'path';
import * as React from 'react';
import { Button, Modal } from 'react-bootstrap';
import * as ReactMarkdown from 'react-markdown';
import * as Redux from 'redux';

export interface IBaseProps {
  visible: boolean;
  onHide: () => void;
}

interface IConnectedProps {
  url: string;
}

interface IActionProps {
  onClose: () => void;
}

interface IComponentState {
  confirmed: boolean;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class BrowserView extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.initState({
      confirmed: false,
    });
  }

  public componentWillReceiveProps(newProps: IProps) {
    if ((newProps.url !== this.props.url)
        && ((newProps.url === undefined) || (this.props.url === undefined)
            || (new URL(newProps.url).hostname !== new URL(this.props.url).hostname))) {
      this.nextState.confirmed = false;
    }
  }

  public render(): JSX.Element {
    const { url, visible } = this.props;
    const { confirmed } = this.state;
    return (
      <Modal id='import-dialog' show={url !== undefined} onHide={this.close}>
        <Modal.Header>
          <Modal.Title>{url}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {confirmed
            ? (<Webview style={{ height: '100%' }} src={url} />)
            : this.renderConfirm()}
        </Modal.Body>
      </Modal>
    );
  }

  private renderConfirm() {
    const { t, url } = this.props;
    return (
      <div>
        <h3>{t('Attention')}</h3>
        <p>{t('Vortex is about to open an external web page:')}</p>
        <a href='#'>{url}</a>
        <p>{t('Please be aware that Vortex is based on electron which in turn is based on '
           + 'Chrome, but it will not always be the newest version. Also, we can\'t rule out '
           + 'that electron might contain it\'s own security issues pertaining to website '
           + 'access.')}</p>
        <p>{t('If you have security concerns or don\'t fully trust this page, please don\'t '
              + 'continue.')}</p>
        <Button onClick={this.confirm}>{t('Continue')}</Button>
      </div>
    );
  }

  private confirm = () => {
    this.nextState.confirmed = true;
  }

  private close = () => {
    this.props.onClose();
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    url: state.session.browser.url,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<IState>): IActionProps {
  return {
    onClose: () => dispatch(closeBrowser()),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      BrowserView)) as React.ComponentClass<IBaseProps>;
