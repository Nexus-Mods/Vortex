import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import bbcode, { stripBBCode } from '../../util/bbcode';
import { MainContext } from '../../views/MainWindow';
import { activeGameId } from '../profile_management/selectors';
import BaseDashlet from './BaseDashlet';
import { MAX_SUMMARY_LENGTH } from './constants';
import { IExtra, IListItem, IModListItem } from './types';

export interface ILatestModsDashletProps {
  title: string;
  emptyText: string;
  eventName: string;
}

function augmentExtra(input: IExtra): IExtra {
  switch (input.id) {
    case 'endorsements': {
      return {
        ...input,
        icon: 'endorse-yes',
        text: '{{ value }}',
      };
    }
    default: return undefined;
  }
}

function transformMod(encoding: string, input: IModListItem): IListItem {
  const res: IListItem = { ...input };

  if (encoding === 'bbcode') {
    res.name = bbcode(res.name as string);
    res.summary = stripBBCode(res.summary as string);
  }

  if (res.summary.length > MAX_SUMMARY_LENGTH) {
    res.summary = (res.summary as string).substring(0, MAX_SUMMARY_LENGTH) + '...';
  }

  if (encoding === 'bbcode') {
    res.summary = bbcode(res.summary as string);
  }

  res.extra = res.extra.map(augmentExtra).filter(iter => iter !== undefined);

  return res;
}

function APIDashlet(props: ILatestModsDashletProps) {
  const { emptyText, eventName, title } = props;

  const { t } = useTranslation();

  const gameMode = useSelector(activeGameId);
  const context = React.useContext(MainContext);

  const [items, setItems] = React.useState<IListItem[]>([]);

  const refresh = React.useCallback(() => {
    (async () => {
      interface IEvtRes { id: string; encoding: string; mods: IModListItem[]; }
      const results = await context.api.emitAndAwait<IEvtRes[]>(eventName, gameMode);
      setItems(results.reduce((prev, res) => [
        ...prev,
        ...res.mods.map(info => transformMod(res.encoding, info)),
      ], []));
    })();
  }, []);

  React.useEffect(() => {
    refresh();
  }, [gameMode]);

  return (
    <BaseDashlet
      t={t}
      title={title}
      items={items}
      emptyText={emptyText}
      onRefresh={refresh}
    />
  );
}

export default APIDashlet;
