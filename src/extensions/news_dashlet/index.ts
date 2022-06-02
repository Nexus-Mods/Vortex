import { IExtensionContext } from '../../types/IExtensionContext';
import { NEXUS_BASE_URL } from '../nexus_integration/constants';
import { activeGameId } from '../profile_management/selectors';

import APIDashlet from './APIDashlet';
import { GAMEID_PLACEHOLDER } from './constants';
import RSSDashlet from './RSSDashlet';

function init(context: IExtensionContext): boolean {
  const t = context.api.translate;
  context.registerDashlet('News', 1, 3, 250, RSSDashlet, undefined, () => ({
    title: t('Latest News'),
    emptyText: t('No News'),
    url: activeGameId(context.api.getState()) !== undefined
      ? `https://www.nexusmods.com/${GAMEID_PLACEHOLDER}/rss/news/`
      : 'https://www.nexusmods.com/rss/news/',
    maxLength: 400,
    extras: [
      { attribute: 'nexusmods:comments', icon: 'comments', text: '{{ count }} comments'},
    ],
  }), undefined);

  context.registerDashlet(
    'Latest Mods', 1, 3, 300, RSSDashlet,
    state => activeGameId(state) !== undefined, () => {
      return {
        title: t('New Files'),
        emptyText: t('No New Files'),
        url: `${NEXUS_BASE_URL}/${GAMEID_PLACEHOLDER}/rss/newtoday/`,
        maxLength: 400,
        extras: [
          { attribute: 'nexusmods:endorsements', icon: 'endorse-yes', text: '{{ value }}' },
          { attribute: 'nexusmods:downloads', icon: 'download', text: '{{ value }}' },
        ],
      };
    }, undefined);

  /*
  context.registerDashlet(
    'Latest Mods', 1, 3, 300, APIDashlet,
    state => activeGameId(state) !== undefined, () => ({
      title: t('New Files'),
      emptyText: t('No New Files'),
      eventName: 'get-latest-mods',
    }), undefined);

  context.registerDashlet(
    'Trending Mods', 1, 3, 300, APIDashlet,
    state => activeGameId(state) !== undefined, () => ({
      title: t('Trending Files'),
      emptyText: t('No Trending Files'),
      eventName: 'get-trending-mods',
    }), undefined);
  */

  return true;
}

export default init;
