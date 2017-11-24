import { remote } from 'electron';
import * as React from 'react';
import { IconButton } from '../controls/TooltipControls';

const app = remote.app;
const window = remote.getCurrentWindow();

class WindowControls extends React.Component<{}, {}> {

  public componentWillMount() {
    window.on('maximize', () => {
      this.forceUpdate();
    });
    window.on('unmaximize', () => {
      this.forceUpdate();
    });
  }

  public render(): JSX.Element {
    return (
      <div id='window-controls'>
        { window.isMinimizable
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
        { window.isMaximizable
          ? (
            <IconButton
              id='window-maximize'
              className='window-control'
              tooltip=''
              icon={window.isMaximized() ? 'window-restore' : 'window-maximize'}
              onClick={this.toggleMaximize}
            />
          ) : null
        }
        { window.isClosable
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
    window.minimize();
  }

  private toggleMaximize = () => {
    window.isMaximized() ? window.unmaximize() : window.maximize();
  }

  private close = () => {
    window.close();
  }
}

export default WindowControls;
