
import * as React from 'react';
import Dashlet from '../../renderer/controls/Dashlet';
import EmptyPlaceholder from '../../renderer/controls/EmptyPlaceholder';
import { ModSpotlightEntryExt } from './types';
import { Button } from '../../renderer/controls/TooltipControls';
import { useTranslation } from 'react-i18next';

interface IBaseProps {
  update: () => ModSpotlightEntryExt[],
}

type ButtonDir = 'left' | 'right';

interface IWebviewProps {
  entry: ModSpotlightEntryExt;
}
function renderWebView(props: IWebviewProps) {
  const { entry } = props;
  return (
    <div className='dashlet-mod-spotlights-webview-container'>
      <iframe
        {...{
          src: entry.link,
          sandbox: 'allow-scripts allow-same-origin allow-presentation allow-forms allow-popups allow-popups-to-escape-sandbox',
          width: '100%',
          height: '335',
          frameBorder: '0',
          referrerPolicy: 'strict-origin-when-cross-origin',
          allow: 'encrypted-media; web-share; fullscreen',
          title: 'YouTube video player',
          style: { border: 0 },
          allowFullScreen: true,
        } as any}
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
    <p className='youtube-privacy-notice'>{t('Playing this video will store cookies on your device')}</p>
  </div>
}

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

  return (
    <Dashlet title='Mods Spotlight' className='dashlet-mod-spotlights'>
      {loaded && renderInfo(t, entries?.[currentIdx])}
      {loaded ? renderWebView({ entry: entries?.[currentIdx] }) : renderPlaceholder()}
      <div className='dashlet-mod-spotlights-button-container'>
        <NavButton entry={entries?.[currentIdx - 1]} dir='left' onClick={back}/>
        <NavButton entry={entries?.[currentIdx + 1]} dir='right' onClick={forward}/>
      </div>
    </Dashlet>
  );
}
