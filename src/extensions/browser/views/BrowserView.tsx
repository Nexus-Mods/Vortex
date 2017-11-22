import Icon from '../../../controls/Icon';
import Webview from '../../../controls/Webview';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import {log} from '../../../util/log';
import MainPage from '../../../views/MainPage';

import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as React from 'react';
import { Modal } from 'react-bootstrap';
import * as ReactMarkdown from 'react-markdown';
import { IState } from '../../../types/IState';
import { closeBrowser } from '../actions';

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
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class BrowserView extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.initState({
    });
  }

  public render(): JSX.Element {
    const { url, visible } = this.props;
    return (
      <Modal id='import-dialog' show={url !== undefined} onHide={this.close}>
        <Modal.Header>
          <Modal.Title>{url}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Webview style={{ height: '100%' }} src={url} />
        </Modal.Body>
      </Modal>
    );
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
