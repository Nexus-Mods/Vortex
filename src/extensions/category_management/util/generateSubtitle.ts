import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';

import { IMod } from '../../mod_management/types/IMod';

import { TFunction } from 'i18next';

/**
 * generate the category's subtitle
 *
 * @param {string} rootId
 * @param {any} mods
 * @return {string}
 */

function generateSubtitle(t: TFunction,
                          categoryId: string,
                          mods: { [categoryId: string]: IMod[] },
                          totalChildModCount?: number) {
  const modsCount = getSafe(mods, [categoryId], []).length;
  let subt: string = (modsCount === 0)
    ? t('Empty') : t('{{ count }} mods installed', {count: modsCount});

  if ((totalChildModCount !== undefined) && (totalChildModCount > 0)) {
    subt = subt + t(' ({{ count }} mods in sub-categories)', {count: totalChildModCount});
  }

  return subt;
}

export default generateSubtitle;
