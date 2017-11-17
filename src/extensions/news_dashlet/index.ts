import { IExtensionContext } from '../../types/IExtensionContext';

import { convertGameId } from '../nexus_integration/util/convertGameId';
import { activeGameId } from '../profile_management/selectors';

import RSSDashlet from './Dashlet';

function init(context: IExtensionContext): boolean {
  context.registerDashlet('News', 1, 3, 200, RSSDashlet, undefined, () => ({
    title: context.api.translate('News'),
    url: 'https://rd.nexusmods.com/rss/news/',
    maxLength: 400,
    extras: [
      { attribute: 'nexusmods:comments', icon: 'commenting', text: '{{ value }} comments'},
    ],
  }), undefined);

  context.registerDashlet(
      'New Files', 1, 3, 360, RSSDashlet,
      state => activeGameId(state) !== undefined, () => {
        const gameId =
            convertGameId(activeGameId(context.api.store.getState()));
        return {
          title: context.api.translate('New Files'),
          url: `https://rd.nexusmods.com/${gameId}/rss/newtoday/`,
          maxLength: 400,
          extras: [
            { attribute: 'nexusmods:endorsements', icon: 'thumbs-up', text: '{{ value }}' },
            { attribute: 'nexusmods:downloads', icon: 'download', text: '{{ value }}' },
          ],
        };
      }, undefined);

  return true;
}

export default init;
