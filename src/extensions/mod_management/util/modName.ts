import {getSafe} from '../../../util/storeHelper';

import {IMod} from '../types/IMod';

export interface INameOptions {
  version: boolean;
}

function modName(mod: IMod, options?: INameOptions): string {
  let fields = [];
  fields.push(getSafe(mod.attributes, ['customFileName'],
                 getSafe(mod.attributes, ['logicalFileName'],
                         getSafe(mod.attributes, ['name'], ''))));

  if (options !== undefined && options.version) {
    fields.push(`(v${getSafe(mod.attributes, ['version'], '?')})`);
  }

  return fields.join(' ');
}

export default modName;
