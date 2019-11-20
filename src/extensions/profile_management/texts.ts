import { TFunction } from 'i18next';

function getText(id: string, t: TFunction) {
  switch (id) {
    case 'profiles':
      return t(
          'Profiles allow you to have multiple mod set-ups for a game at once and quickly ' +
          'switch between them. This can be useful when you have multiple playthroughs in ' +
          'parallel or if multiple people play the same game on your computer.\n\n' +
          'All profiles for a game share the set of "available" mods, but each has its own ' +
          'list of "enabled" mods.\n\n' +
          'Depending on the game, profiles can also have different plugins enabled, separate ' +
          'save games, separate game configuration and so on.');
    default:
      return undefined;
  }
}

export default getText;
