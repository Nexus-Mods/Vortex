
import * as React from 'react';
import Dashlet from '../../controls/Dashlet';
import { MainContext } from '../../views/MainWindow';
import { Popover } from 'react-bootstrap';
import Webview from '../../controls/Webview';
import Icon from '../../controls/Icon';
import { util } from 'vortex-api';


export default function TopModsDashlet() {

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
    <Dashlet title='Mods of the Month' className='dashlet-mods-of-the-mods'>

      <div>Some intro text here?</div>

      <div className='dashlet-mods-of-the-month-webview-container'>

          <Webview
            src={'https://www.youtube.com/embed/eYP_HWIswoE?si=JqVJ8tNV5jDq4y6N&origin=vortex.com'}
            allowFullScreen
            onNewWindow={onNewWindow}
            //onFullscreen={onFullscreen}
          />          

      </div>
    </Dashlet>
  );

}
