import { log } from '../util/log';

import { WebviewTag } from 'electron';
import { omit } from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

export interface IWebView {
  src?: string;
  style?: any;
  autosize?: boolean;
  nodeintegration?: boolean;
  plugins?: boolean;
  preload?: string;
  httpreferrer?: string;
  useragent?: string;
  disablewebsecurity?: boolean;
  partition?: string;
  webpreferences?: string;
  blinkfeatures?: string;
  disableblinkfeatures?: string;
  guestinstance?: string;
}

export interface IWebviewProps {
  onLoading?: (loading: boolean) => void;
}

class Webview extends React.Component<IWebviewProps & IWebView, {}> {
  private mNode: WebviewTag;

  public componentDidMount() {
    this.mNode = ReactDOM.findDOMNode(this) as WebviewTag;

    this.mNode.addEventListener('did-start-loading', this.startLoad);
    this.mNode.addEventListener('did-stop-loading', this.stopLoad);
    this.mNode.addEventListener('dom-ready', () => {
      // this.mNode.insertCSS('body { background-color: red !important }');
      // this.mNode.openDevTools();
    });
    this.mNode.addEventListener('console-message', this.logMessage);

    // this.mNode.getWebContents().session.cookies.get()
  }

  public componentWillUnmount() {
    this.mNode.removeEventListener('did-start-loading', this.startLoad);
    this.mNode.removeEventListener('did-stop-loading', this.stopLoad);
    this.mNode.removeEventListener('console-message', this.logMessage);

  }

  public render(): JSX.Element {
    return React.createElement('webview', omit(this.props, ['onLoading']));
  }

  private startLoad = () => {
    const { onLoading } = this.props;
    if (onLoading !== undefined) {
      onLoading(true);
    }
  }

  private stopLoad = () => {
    const { onLoading } = this.props;
    if (onLoading !== undefined) {
      onLoading(false);
    }
  }

  private logMessage = (evt) => {
    if (evt.level > 1) {
      log('info', 'from embedded page', evt.message);
    }
  }
}

export default Webview;
