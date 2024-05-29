
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
    <Dashlet title='Top Mods of the Month' className='dashlet-top-mods'>
      <div>Some intro text here?</div>

          <Webview
            style={{flex: 'auto'}}
            src={'https://www.youtube.com/embed/eYP_HWIswoE?si=JqVJ8tNV5jDq4y6N'}
            allowFullScreen
            onNewWindow={onNewWindow}
            //onFullscreen={onFullscreen}
          />          

    </Dashlet>
  );

}
