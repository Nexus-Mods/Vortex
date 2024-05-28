
import * as React from 'react';
import Dashlet from '../../controls/Dashlet';
import { MainContext } from '../../views/MainWindow';
import { Popover } from 'react-bootstrap';
import Webview from '../../controls/Webview';
import Icon from '../../controls/Icon';
import { util } from 'vortex-api';

export const VIDEO_WIDTH = 416;
export const VIDEO_HEIGHT = 234;

interface IBaseProps {
  
}

export default function TopModsDashlet(props:IBaseProps) {

  const context = React.useContext(MainContext);

  const onFullscreen = (fullscreen: boolean) => {
    this.nextState.fullscreen = fullscreen;
  }

  const onNewWindow = (url: string) => {
    util.opn(url).catch(() => null);
  }

  const stopClickEvent = (e) => {
    e.stopPropagation();
  }



  return (
    <Dashlet title='Top Mods of the Month' className='dashlet-top-mods'>
      <p>Some intro text here?</p>
        <div>
          <Webview
            style={{width: VIDEO_WIDTH, height: VIDEO_HEIGHT}}
            src={'https://www.youtube.com/embed/eYP_HWIswoE?si=JqVJ8tNV5jDq4y6N'}
            allowFullScreen
            onNewWindow={onNewWindow}
            onFullscreen={onFullscreen}
          />          
        </div>

    </Dashlet>
  );

}
