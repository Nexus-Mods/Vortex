import * as React from "react";
import { IconButton } from "../controls/TooltipControls";

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
    // Fetch initial maximized state
    window.api.window
      .isMaximized(window.windowId)
      .then((maximized: boolean) => {
        this.setState({ isMaximized: maximized });
      });

    // Subscribe to window events
    this.mUnsubscribeMaximize = window.api.window.onMaximize(this.onMaximize);
    this.mUnsubscribeUnmaximize = window.api.window.onUnmaximize(
      this.onUnMaximize,
    );
    this.mUnsubscribeClose = window.api.window.onClose(this.onClose);
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
    void window.api.window.minimize(window.windowId);
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
    const { isMaximized } = this.state;
    if (isMaximized) {
      void window.api.window.unmaximize(window.windowId);
    } else {
      void window.api.window.maximize(window.windowId);
    }
  };

  private close = () => {
    void window.api.window.close(window.windowId);
  };
}

export default WindowControls;
