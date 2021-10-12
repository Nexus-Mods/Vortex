import { log } from '../util/log';
import { truthy } from '../util/util';
import { closeBrowserView, makeBrowserView, positionBrowserView, updateViewURL } from '../util/webview';

import { ipcRenderer } from 'electron';
import * as React from 'react';

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
    if (container.current !== undefined) {
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

class Webview extends React.Component<IWebviewProps & IWebView, {}> {
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

export default Webview;
