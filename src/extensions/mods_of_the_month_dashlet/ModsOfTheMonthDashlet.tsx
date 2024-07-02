
import * as React from 'react';
import Dashlet from '../../controls/Dashlet';
import Webview from '../../controls/Webview';
import EmptyPlaceholder from '../../controls/EmptyPlaceholder';
import open from '../../util/opn';
import Debouncer from '../../util/Debouncer';
import { IMOTMEntryExt } from './types';
import { Button } from '../../controls/TooltipControls';
import { useTranslation } from 'react-i18next';

interface IBaseProps {
  update: () => IMOTMEntryExt[],
}

type ButtonDir = 'left' | 'right';

interface IWebviewProps {
  entry: IMOTMEntryExt;
  onNewWindow: (url: string) => void;
}
function renderWebView(props: IWebviewProps) {
  const { entry, onNewWindow } = props;
  return (
    <div className='dashlet-mods-of-the-month-webview-container'>
      <Webview
        src={entry.link}
        allowFullScreen
        onNewWindow={onNewWindow}
      />
    </div>
  );
}

function renderPlaceholder() {
  return <div className='dashlet-mods-of-the-month-webview-container'>
    <EmptyPlaceholder icon='video' text='Our hamsters need a break...'/>
  </div>
}

function renderButton(entry: IMOTMEntryExt, dir: ButtonDir, onClick: () => void) {
  const classes = dir === 'left'
    ? ['btn-ghost', 'left', 'smaller']
    : ['btn-ghost', 'right', 'smaller'];
  return !entry ? null : (
    <Button
      className={classes.join(' ')}
      onClick={onClick}
      tooltip={'Switch to ' + entry.month + '' + entry.year}
    >
      {dir === 'left' ? '◄ ' + entry.month : entry.month + ' ►'}
    </Button>
  )
}

function renderInfo(t: any, entry: IMOTMEntryExt) {
  const { month, year } = entry;
  return entry.id === 'placeholder' ? null : <div className='dashlet-mods-of-the-month-info'>
    <p>{t('Discover our top picks from {{month}} {{year}}', { replace: { month, year } })}</p>
  </div>
}

// Our WebView component does not remove listeners correctly for the onNewWindow event;
//  this means that dynamic src changes will keep adding listeners to the same stupid
//  component. This is a workaround to ensure that we only open one window at a time.
//  What makes this worse is the fact that the dashboard is refreshed every second.
const debounce = new Debouncer((url) => open(url).catch(() => null), 250, true, false);

export default function TopModsDashlet(props: IBaseProps) {
  const [t] = useTranslation(['common']);
  const [currentIdx, setIdx] = React.useState<number>(-1);
  const [entries, setEntries] = React.useState<IMOTMEntryExt[]>([]);
  const [loaded, setLoaded] = React.useState<boolean>(false);
  React.useEffect(() => {
    const runUpdate = async () => {
      const motm = await props.update();
      if (motm.length !== 0) {
        setEntries(motm);
        setIdx(Math.max(0, motm.length - 1));
        setLoaded(true);
      }
    }
    if (entries.length === 0) {
      runUpdate();
    }
  }, [entries]);

  const back = React.useCallback(() => {
    setIdx(Math.max(0, currentIdx - 1));
  }, [currentIdx]);

  const forward = React.useCallback(() => {
    setIdx(Math.min(entries.length - 1, currentIdx + 1));
  }, [currentIdx, entries]);

  const onNewWindow = React.useCallback((url: string) => {
    debounce.schedule((err) => null, url);
  }, [currentIdx]);
  return (
    <Dashlet title='Mods of the Month' className='dashlet-mods-of-the-month'>
      {loaded && renderInfo(t, entries?.[currentIdx])}
      {loaded ? renderWebView({ entry: entries?.[currentIdx], onNewWindow }) : renderPlaceholder()}
      <div className='dashlet-mods-of-the-month-button-container'>
        {renderButton(entries?.[currentIdx - 1], 'left', back)}
        {renderButton(entries?.[currentIdx + 1], 'right', forward)}
      </div>
    </Dashlet>
  );
}
