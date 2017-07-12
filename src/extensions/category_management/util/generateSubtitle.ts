import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';

import { IMod } from '../../mod_management/types/IMod';

import * as I18next from 'i18next';

/**
 * generate the category's subtitle
 *
 * @param {string} rootId
 * @param {any} mods
 * @return {string}
 */

function generateSubtitle(t: I18next.TranslationFunction,
                          categoryId: string,
                          mods: { [categoryId: string]: IMod[] }) {
  const modsCount = getSafe(mods, [categoryId], []).length;

  if (modsCount === 0) {
    return t('Empty');
  } else {
    return t('{{ count }} mod installed', {count: modsCount});
  }
}

export default generateSubtitle;
