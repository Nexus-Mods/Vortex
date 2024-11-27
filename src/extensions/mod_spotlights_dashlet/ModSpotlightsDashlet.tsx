
import * as React from 'react';
import Dashlet from '../../controls/Dashlet';
import Webview from '../../controls/Webview';
import EmptyPlaceholder from '../../controls/EmptyPlaceholder';
import open from '../../util/opn';
import Debouncer from '../../util/Debouncer';
import { ModSpotlightEntryExt } from './types';
import { Button } from '../../controls/TooltipControls';
import { useTranslation } from 'react-i18next';

interface IBaseProps {
  update: () => ModSpotlightEntryExt[],
}

type ButtonDir = 'left' | 'right';

interface IWebviewProps {
  entry: ModSpotlightEntryExt;
  onNewWindow: (url: string) => void;
}
function renderWebView(props: IWebviewProps) {
  const { entry, onNewWindow } = props;
  return (
    <div className='dashlet-mod-spotlights-webview-container'>
      <Webview
        src={entry.link}
        allowFullScreen
        onNewWindow={onNewWindow}
      />
    </div>
  );
}

function renderPlaceholder() {
  return <div className='dashlet-mod-spotlights-webview-container'>
    <EmptyPlaceholder icon='video' text='Our hamsters need a break...'/>
  </div>
}

interface IButtonProps {
  entry: ModSpotlightEntryExt;
  dir: ButtonDir;
  onClick: () => void;
}

function NavButton(props: IButtonProps) {
  const { entry, dir, onClick } = props;
  const [t] = useTranslation(['common']);
  const classes = dir === 'left'
    ? ['btn-ghost', 'left', 'smaller']
    : ['btn-ghost', 'right', 'smaller'];
  return !entry ? null : (
    <Button
      className={classes.join(' ')}
      onClick={onClick}
      tooltip={t(dir === 'left' ? 'Previous Video' : 'Next Video')}
    >
      {dir === 'left' ? '◄ ' + `${t('Previous')}` : `${t('Next')}` + ' ►'}
    </Button>
  )
}

function renderInfo(t: any, entry: ModSpotlightEntryExt) {
  return entry.id === 'placeholder' ? null : <div className='dashlet-mod-spotlights-info'>
    <p>{t('Here are some mods we think you should try out!')}</p>
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
  const [entries, setEntries] = React.useState<ModSpotlightEntryExt[]>([]);
  const [loaded, setLoaded] = React.useState<boolean>(false);
  React.useEffect(() => {
    const runUpdate = async () => {
      const updated = await props.update();
      if (updated.length !== 0) {
        setEntries(updated);
        setIdx(Math.max(0, updated.length - 1));
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
    <Dashlet title='Mods Spotlight' className='dashlet-mod-spotlights'>
      {loaded && renderInfo(t, entries?.[currentIdx])}
      {loaded ? renderWebView({ entry: entries?.[currentIdx], onNewWindow }) : renderPlaceholder()}
      <div className='dashlet-mod-spotlights-button-container'>
        <NavButton entry={entries?.[currentIdx - 1]} dir='left' onClick={back}/>
        <NavButton entry={entries?.[currentIdx + 1]} dir='right' onClick={forward}/>
      </div>
    </Dashlet>
  );
}
