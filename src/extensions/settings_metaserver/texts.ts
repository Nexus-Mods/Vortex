import { TFunction } from '../../util/i18n';

function getText(id: string, t: TFunction) {
  switch (id) {
    case 'meta-server': return t(
      'A meta server provides additional information about mods, giving you '
      + 'more details and dependency information about them. By default you '
      + 'get this data from nexusmods.com but it\'s possible for others to set '
      + 'up their own servers and then you can add those here to use them.');
    default: return undefined;
  }
}

export default getText;
