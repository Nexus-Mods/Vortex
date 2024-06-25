
import * as React from 'react';
import Dashlet from '../../controls/Dashlet';
import Webview from '../../controls/Webview';
import { EmptyPlaceholder, Spinner, util } from 'vortex-api';
import { IMOTMEntryExt } from './types';
import { Button } from '../../controls/TooltipControls';

interface IBaseProps {
  update: () => IMOTMEntryExt[],
}

type ButtonDir = 'left' | 'right';
const placeHolder: IMOTMEntryExt = {
  id: 'placeholder',
  link: 'https://www.youtube.com/embed/eYP_HWIswoE?si=JqVJ8tNV5jDq4y6N&origin=vortex.com',
  date: Date.now(),
  month: 'Shmanuary',
  year: '2024',
}

function renderWebView(entry: IMOTMEntryExt, onNewWindow: (url: string) => void) {
  return !entry || entry.id === 'placeholder' ? renderPlaceholder() : <div className='dashlet-mods-of-the-month-webview-container'>
    <Webview
      src={entry.link}
      allowFullScreen
      onNewWindow={onNewWindow}
    />
  </div>
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
      {dir === 'left' ? '‹ ' + entry.month : entry.month + ' ›'}
    </Button>
  )
}

function renderInfo(entry: IMOTMEntryExt) {
  return entry.id === 'placeholder' ? null : <div className='dashlet-mods-of-the-month-info'>
    <p>Discover our top picks from {entry.month + ' ' + entry.year}</p>
  </div>
}

export default function TopModsDashlet(props: IBaseProps) {
  const [currentIdx, setIdx] = React.useState<number>(-1);
  const [entries, setEntries] = React.useState<IMOTMEntryExt[]>([]);
  React.useEffect(() => {
    const runUpdate = async () => {
      const motm = await props.update();
      if (motm.length === 0) {
        setEntries([placeHolder]);
        setIdx(0);
      } else {
        setEntries(motm);
        setIdx(Math.max(0, motm.length - 1));
      }
    }
    if (!entries || entries.length === 0) {
      runUpdate();
    }
  }, [entries, currentIdx, setIdx, setEntries]);

  const back = React.useCallback(() => {
    setIdx(Math.max(0, currentIdx - 1));
  }, [setIdx, currentIdx, entries]);

  const forward = React.useCallback(() => {
    setIdx(Math.min(entries.length - 1, currentIdx + 1));
  }, [setIdx, currentIdx, entries]);

  const onNewWindow = (url: string) => {
    util.opn(url).catch(() => null);
  }
  return (
    <Dashlet title='Mods of the Month' className='dashlet-mods-of-the-month'>
      {currentIdx !== -1 && renderInfo(entries?.[currentIdx])}
      {currentIdx !== -1 && renderWebView(entries?.[currentIdx], onNewWindow)}
      <div className='dashlet-mods-of-the-month-button-container'>
        {renderButton(entries?.[currentIdx - 1], 'left', back)}
        {renderButton(entries?.[currentIdx + 1], 'right', forward)}
      </div>
    </Dashlet>
  );
}
