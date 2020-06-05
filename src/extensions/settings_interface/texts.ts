import { TFunction } from 'i18next';

function getText(id: string, t: TFunction) {
  switch (id) {
    case 'advanced':
      return t(
          'In advanced mode Vortex will show a couple of features ' +
          'that will be useful to experienced users but would either ' +
          'be confusing to new users or could be used to break things ' +
          'if used incorrectly or accidentally. Hence they are ' +
          'disabled by default.');
    case 'toplevel-categories':
      return t(
        'Categories are maintained as a tree, so for example the Category "Audio" '
        + 'could have child categories "Effects" and "Music". If you\'re using the '
        + 'Categories from Nexus, you will find that all categories have a rather useless '
        + '"root" that corresponds to the game name, so the whole path '
        + 'would be "Skyrim -> Audio -> Effects".\n'
        + 'This option will shorten the displayed category by hiding that root.');
    default:
      return undefined;
  }
}

export default getText;
