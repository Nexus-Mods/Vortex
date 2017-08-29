import {getSafe} from '../../../util/storeHelper';

import {IMod} from '../types/IMod';

export interface INameOptions {
  version: boolean;
}

/**
 * determins the mod name to show to the user based on the mod attributes.
 * absolutely never use this function for anything other than showing the output
 * to the user, the output must not be stored or used as an identifier for the mod,
 * I reserve the right to change the algorithm at any time.
 * @param {IMod} mod
 * @param {INameOptions} [options]
 * @returns {string}
 */
function modName(mod: IMod, options?: INameOptions): string {
  const fields = [];
  fields.push(getSafe(mod.attributes, ['customFileName'],
                      getSafe(mod.attributes, ['logicalFileName'],
                              getSafe(mod.attributes, ['fileName'],
                                      getSafe(mod.attributes, ['name'], '')))));

  if (options !== undefined && options.version) {
    fields.push(`(v${getSafe(mod.attributes, ['version'], '?')})`);
  }

  return fields.join(' ');
}

export default modName;
