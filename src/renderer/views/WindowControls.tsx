import * as React from "react";
import { IconButton } from "../controls/TooltipControls";
import { getPreloadApi, getWindowId } from "../../util/preloadAccess";

class WindowControls extends React.Component<{}, { isMaximized: boolean }> {
  private mClosed: boolean = false;
  private mUnsubscribeMaximize: (() => void) | null = null;
  private mUnsubscribeUnmaximize: (() => void) | null = null;
  private mUnsubscribeClose: (() => void) | null = null;

  constructor(props: {}) {
    super(props);

    this.state = {
      isMaximized: false,
    };
  }

  public componentDidMount() {
    const api = getPreloadApi();
    const windowId = getWindowId();

    // Fetch initial maximized state
    api.window.isMaximized(windowId).then((maximized: boolean) => {
      this.setState({ isMaximized: maximized });
    });

    // Subscribe to window events
    this.mUnsubscribeMaximize = api.window.onMaximize(this.onMaximize);
    this.mUnsubscribeUnmaximize = api.window.onUnmaximize(this.onUnMaximize);
    this.mUnsubscribeClose = api.window.onClose(this.onClose);
  }

  public componentWillUnmount() {
    this.mUnsubscribeMaximize?.();
    this.mUnsubscribeUnmaximize?.();
    this.mUnsubscribeClose?.();
  }

  public render(): JSX.Element {
    const { isMaximized } = this.state;
    if (this.mClosed) {
      return null;
    }
    return (
      <div id="window-controls">
        <IconButton
          id="window-minimize"
          className="window-control"
          tooltip=""
          icon="window-minimize"
          onClick={this.minimize}
        />
        <IconButton
          id="window-maximize"
          className="window-control"
          tooltip=""
          icon={isMaximized ? "window-restore" : "window-maximize"}
          onClick={this.toggleMaximize}
        />
        <IconButton
          id="window-close"
          className="window-control"
          tooltip=""
          icon="window-close"
          onClick={this.close}
        />
      </div>
    );
  }

  private minimize = () => {
    const api = getPreloadApi();
    const windowId = getWindowId();
    void api.window.minimize(windowId);
  };

  private onMaximize = () => {
    this.setState({ isMaximized: true });
    this.forceUpdate();
  };

  private onUnMaximize = () => {
    this.setState({ isMaximized: false });
    this.forceUpdate();
  };

  private onClose = () => {
    this.mClosed = true;
  };

  private toggleMaximize = () => {
    const api = getPreloadApi();
    const windowId = getWindowId();
    const { isMaximized } = this.state;
    if (isMaximized) {
      void api.window.unmaximize(windowId);
    } else {
      void api.window.maximize(windowId);
    }
  };

  private close = () => {
    const api = getPreloadApi();
    const windowId = getWindowId();
    void api.window.close(windowId);
  };
}

export default WindowControls;
