import { remote } from 'electron';
import * as React from 'react';
import { IconButton } from '../controls/TooltipControls';

const window = (() => {
  let res: Electron.BrowserWindow;
  return () => {
    if (res === undefined) {
      res = remote.getCurrentWindow();
    }
    return res;
  };
})();

class WindowControls extends React.Component<{}, { isMaximized: boolean }> {
  private mClosed: boolean = false;

  constructor(props: {}) {
    super(props);

    this.state = {
      isMaximized: window().isMaximized(),
    };
  }

  public componentDidMount() {
    window().on('maximize', this.onMaximize);
    window().on('unmaximize', this.onUnMaximize);
    window().on('close', this.onClose);
  }

  public componentWillUnmount() {
    window().removeListener('maximize', this.onMaximize);
    window().removeListener('unmaximize', this.onUnMaximize);
    window().removeListener('close', this.onClose);
  }

  public render(): JSX.Element {
    const { isMaximized } = this.state;
    if (this.mClosed) {
      return null;
    }
    return (
      <div id='window-controls'>
        <IconButton
          id='window-minimize'
          className='window-control'
          tooltip=''
          icon='window-minimize'
          onClick={this.minimize}
        />
        <IconButton
          id='window-maximize'
          className='window-control'
          tooltip=''
          icon={isMaximized ? 'window-restore' : 'window-maximize'}
          onClick={this.toggleMaximize}
        />
        <IconButton
          id='window-close'
          className='window-control'
          tooltip=''
          icon='window-close'
          onClick={this.close}
        />
      </div>
    );
  }

  private minimize = () => {
    window().minimize();
  }

  private onMaximize = () => {
    this.setState({ isMaximized: true });
    this.forceUpdate();
  }

  private onUnMaximize = () => {
    this.setState({ isMaximized: false });
    this.forceUpdate();
  }

  private onClose = () => {
    this.mClosed = true;
  }

  private toggleMaximize = () => {
    const wasMaximized = window().isMaximized();
    wasMaximized ? window().unmaximize() : window().maximize();
  }

  private close = () => {
    window().close();
  }
}

export default WindowControls;
