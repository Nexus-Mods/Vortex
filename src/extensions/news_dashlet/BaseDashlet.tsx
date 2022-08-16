import React from 'react';
import { Alert, ListGroup, ListGroupItem } from 'react-bootstrap';
import Dashlet from '../../controls/Dashlet';
import EmptyPlaceholder from '../../controls/EmptyPlaceholder';
import Icon from '../../controls/Icon';
import { IconButton } from '../../controls/TooltipControls';
import { TFunction } from '../../util/i18n';
import opn from '../../util/opn';
import { MainContext } from '../../views/MainWindow';
import { IExtra, IListItem } from './types';

export interface IBaseDashletProps {
  t: TFunction;
  title: string;
  items: IListItem[];
  error?: string;
  emptyText: string;
  onRefresh?: () => void;
}

interface INewsItemProps {
  t: TFunction;
  item: IListItem;
  title: string;
}

interface INewsExtraProps {
  t: TFunction;
  item: IExtra;
}

function NewsExtra(props: INewsExtraProps) {
  const { t, item } = props;

  const { value, icon, text } = item;

  let count: number;
  {
    const tmp = (new Number(value).valueOf());
    if (!Number.isNaN(tmp)) {
      count = tmp;
    }
  }

  return (
    <div>
      <Icon name={icon} />{t(text, { replace: { value, count }, count })}
    </div>
  );
}

function NewsItem(props: INewsItemProps) {
  const { t, item, title } = props;

  const { category, extra, imageUrl, link, name, summary } = item;

  const context = React.useContext(MainContext);

  const openMore = React.useCallback((evt: React.MouseEvent<any>) => {
    context.api.events.emit('analytics-track-click-event', 'Dashboard', `View ${title}`);
    evt.preventDefault();
    opn(link).catch(err => undefined);
  }, [link, title]);

  return (
    <ListGroupItem className='rss-item'>
      {category ? <div className='rss-category'>{category}</div> : null}
      <div
        className='rss-image'
        style={{ background: imageUrl !== undefined ? `url(${imageUrl})` : undefined }}
      />
      <h4><a href={link} onClick={openMore}>{name}</a></h4>
      <p className='rss-summary'>{summary}</p>
      {
        (extra !== undefined)
          ? (
            <div className='rss-extras'>
              {extra.map((iter, idx) => <NewsExtra key={idx} t={t} item={iter} />)}
            </div>
          ) : null
      }
    </ListGroupItem>
  );
}

function BaseDashlet(props: IBaseDashletProps) {
  const { t, emptyText, error, items, onRefresh, title } = props;

  return (
    <Dashlet className='dashlet-news' title={title}>
      {(onRefresh !== undefined) ? (
        <IconButton
          className='issues-refresh'
          icon='refresh'
          tooltip={t('Refresh')}
          onClick={onRefresh}
        />
      ) : null}

      {error !== undefined ? <Alert>{t('No messages received')}</Alert> : null}

      {((items ?? []).length !== 0) ? (
        <ListGroup className='list-news'>
          {items.map((msg, idx) => <NewsItem key={idx} t={t} item={msg} title={title} />)}
        </ListGroup>
      ) : (
        <EmptyPlaceholder
          icon='layout-list'
          text={emptyText}
          subtext={t('*crickets chirp*')}
        />
      )}
    </Dashlet>
  );
}

export default BaseDashlet;
