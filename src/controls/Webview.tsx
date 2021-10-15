/**
 * Two implementations of embedding web content, both have drawbacks.
 * WebViewOverlay uses the electron BrowserView api, sized automatically to be positioned inside
 * a div in the DOM.
 * Browser functionality seems to be perfect, but it is rendered as a fully separate view on top
 * of the rest of Vortex and can thus not be overlayed. As such it will also not disappear until
 * unmounted (or set to an empty url).
 * Thus care has to be taken how this is utilized or it will appear broken and janky
 *
 * WebviewEmbed uses the chrome <webview> component which integrates better but doesn't seem to
 * forward all events correcty. Specifically we were not able to handle any event when clicking
 * the download button on google drive. (as of Electron 15.1.1)
 */

import { log } from '../util/log';
import { truthy } from '../util/util';
import { closeBrowserView, makeBrowserView, positionBrowserView, updateViewURL } from '../util/webview';

import { ipcRenderer } from 'electron';
import { omit } from 'lodash';
import * as React from 'react';
import ReactDOM from 'react-dom';

const RESIZE_EVENTS = ['scroll', 'resize'];

export interface IWebView extends
      React.DetailedHTMLProps<React.WebViewHTMLAttributes<HTMLWebViewElement>, HTMLWebViewElement> {
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
  onNewWindow?: (url: string, disposition: string) => void;
  onFullscreen?: (fullscreen: boolean) => void;
}

interface IBrowserViewProps {
  src: string;
  events: { [name: string]: (...args: any[]) => void };
}

function BrowserView(props: IBrowserViewProps) {
  const viewId = React.useRef<string>();
  const container = React.useRef<HTMLDivElement>();

  const updateViewBounds = React.useCallback(() => {
    if (truthy(container.current)) {
      const rect = container.current.getBoundingClientRect();

      const bounds: Electron.Rectangle = {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };

      positionBrowserView(viewId.current, bounds);
    }
  }, []);

  React.useEffect(() => {
    updateViewURL(viewId.current, props.src);
  }, [props.src]);

  React.useEffect(() => {
    const impl = async () => {
      viewId.current = await makeBrowserView(props.src, Object.keys(props.events));

      RESIZE_EVENTS.forEach(evtId => {
        window.addEventListener(evtId, updateViewBounds);
      });

      Object.keys(props.events)
        .forEach(evtId => {
          ipcRenderer.on(`view-${viewId.current}-${evtId}`, (evt, argsJSON) => {
            props.events[evtId](...JSON.parse(argsJSON));
          });
        });
      updateViewBounds();
    };

    impl();

    return () => {
      closeBrowserView(viewId.current);
      RESIZE_EVENTS.forEach(evtId => {
        window.removeEventListener(evtId, updateViewBounds);
      });

      Object.keys(props.events)
        .forEach(evtId => {
          ipcRenderer.removeAllListeners(`view-${viewId.current}-${evtId}`);
        });
    };
  }, []);

  return (
    <div
      ref={container}
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
}

export class WebviewOverlay extends React.Component<IWebviewProps & IWebView, {}> {
  public render(): JSX.Element {
    return truthy(this.props.src) ? (
      <BrowserView
        src={this.props.src}
        events={{
          'did-start-loading': this.startLoad,
          'did-stop-loading': this.stopLoad,
          'console-message': this.logMessage,
          'new-window': this.newWindow,
          'enter-html-full-screen': this.enterFullscreen,
          'leave-html-full-screen': this.leaveFullscreen,
        }}
      />
    ) : null;
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

  private newWindow = (url: string, frameName: string, disposition: string) => {
    const { onNewWindow } = this.props;
    if (onNewWindow !== undefined) {
      onNewWindow(url, disposition);
    }
  }

  private enterFullscreen = () => {
    const { onFullscreen } = this.props;

    if (onFullscreen !== undefined) {
      onFullscreen(true);
    }
  }

  private leaveFullscreen = () => {
    const { onFullscreen } = this.props;

    if (onFullscreen !== undefined) {
      onFullscreen(false);
    }
  }

  private logMessage = (level, message) => {
    if (level > 2) {
      log('info', 'from embedded page', { level, message });
    }
  }
}

export class WebviewEmbed extends React.Component<IWebviewProps & IWebView, {}> {
  private mNode: HTMLElement;

  public componentDidMount() {
    this.mNode = ReactDOM.findDOMNode(this) as HTMLElement;
    this.mNode.addEventListener('did-start-loading', this.startLoad);
    this.mNode.addEventListener('did-stop-loading', this.stopLoad);
    this.mNode.addEventListener('dom-ready', () => {
      // TODO as of electron 15.1.1 (since 14.?.?), webview doesn't support transparent
      //   background, so it won't properly embed in the page. This at least makes the
      //   pages readable
      (this.mNode as any).insertCSS(
        'body.mediawiki, #content, #mw-pages > table { background-color: #4c4c4c !important }');
      // (this.mNode as any).openDevTools();
    });
    this.mNode.addEventListener('console-message', this.logMessage);
    this.mNode.addEventListener('new-window', this.newWindow);
    this.mNode.addEventListener('enter-html-full-screen', this.enterFullscreen);
    this.mNode.addEventListener('leave-html-full-screen', this.leaveFullscreen);
  }

  public componentWillUnmount() {
    this.mNode.removeEventListener('did-start-loading', this.startLoad);
    this.mNode.removeEventListener('did-stop-loading', this.stopLoad);
    this.mNode.removeEventListener('console-message', this.logMessage);
    this.mNode.removeEventListener('new-window', this.newWindow);
    this.mNode.removeEventListener('enter-html-full-screen', this.enterFullscreen);
    this.mNode.removeEventListener('leave-html-full-screen', this.leaveFullscreen);
  }

  public render(): JSX.Element {
    return React.createElement('webview', omit(this.props, ['onLoading', 'onNewWindow', 'onFullscreen']));
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

  private newWindow = (evt) => {
    const { onNewWindow } = this.props;
    if (onNewWindow !== undefined) {
      onNewWindow(evt.url, evt.disposition);
    }
  }

  private enterFullscreen = (evt) => {
    const { onFullscreen } = this.props;

    if (onFullscreen !== undefined) {
      onFullscreen(true);
    }
  }

  private leaveFullscreen = (evt) => {
    const { onFullscreen } = this.props;

    if (onFullscreen !== undefined) {
      onFullscreen(false);
    }
  }

  private logMessage = (evt) => {
    if (evt.level > 2) {
      log('info', 'from embedded page', { level: evt.level, message: evt.message });
    }
  }
}

export default WebviewEmbed;
