import {getSafe} from '../../../util/storeHelper';

import {IMod, IModReference} from '../types/IMod';

export interface INameOptions {
  version?: boolean;
  variant?: boolean;
}

export function modNameFromAttributes(mod: { [key: string]: any }, options?: INameOptions): string {
  const fields = [];
  fields.push(
    getSafe(mod, ['customFileName'], '')
    || getSafe(mod, ['logicalFileName'], '')
    || getSafe(mod, ['fileName'], '')
    || getSafe(mod, ['name'], ''));

  if (options?.version) {
    fields.push(`(v${getSafe(mod, ['version'], '?')})`);
  }

  if (options?.variant && (mod?.variant !== undefined)) {
    fields.push(`(${mod.variant})`);
  }

  return fields.join(' ');
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
  if ((mod === undefined) || (mod.attributes === undefined)) {
    return undefined;
  }
  return modNameFromAttributes(mod.attributes, options) || mod.installationPath;
}

export interface IRenderOptions {
  version?: boolean;
}

export function renderModReference(ref?: IModReference, mod?: IMod, options?: IRenderOptions) {
  const version = (options === undefined) || options.version !== false;

  if (mod !== undefined) {
    return modName(mod, { version });
  }

  if (ref === undefined) {
    return '<Invalid reference>';
  }

  if (ref.description !== undefined) {
    return ref.description;
  }

  if ((ref.logicalFileName === undefined) && (ref.fileExpression === undefined)) {
    return ref.fileMD5 || ref.id || '<Invalid reference>';
  }

  let name = ref.logicalFileName || ref.fileExpression || '<Invalid reference>';
  if ((ref.versionMatch !== undefined) && version) {
    name += ' v' + ref.versionMatch;
  }
  return name;
}

export default modName;
