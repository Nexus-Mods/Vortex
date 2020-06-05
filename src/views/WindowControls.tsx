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

class WindowControls extends React.Component<{}, {}> {
  public componentDidMount() {
    window().on('maximize', this.onMaximize);
    window().on('unmaximize', this.onMaximize);
  }

  public componentWillUnmount() {
    window().removeListener('maximize', this.onMaximize);
    window().removeListener('unmaximize', this.onMaximize);
  }

  public render(): JSX.Element {
    if (window().isDestroyed()) {
      return null;
    }
    return (
      <div id='window-controls'>
        { window().minimizable
          ? (
            <IconButton
              id='window-minimize'
              className='window-control'
              tooltip=''
              icon='window-minimize'
              onClick={this.minimize}
            />
          ) : null
        }
        { window().maximizable
          ? (
            <IconButton
              id='window-maximize'
              className='window-control'
              tooltip=''
              icon={window().isMaximized() ? 'window-restore' : 'window-maximize'}
              onClick={this.toggleMaximize}
            />
          ) : null
        }
        { window().closable
          ? (
            <IconButton
              id='window-close'
              className='window-control'
              tooltip=''
              icon='window-close'
              onClick={this.close}
            />
          ) : null
        }
      </div>
    );
  }

  private minimize = () => {
    window().minimize();
  }

  private onMaximize = () => {
    this.forceUpdate();
  }

  private toggleMaximize = () => {
    window().isMaximized() ? window().unmaximize() : window().maximize();
  }

  private close = () => {
    window().close();
  }
}

export default WindowControls;
