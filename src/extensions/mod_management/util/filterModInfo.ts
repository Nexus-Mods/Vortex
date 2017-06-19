import { AttributeExtractor } from '../../../types/IExtensionContext';
import {getSafe} from '../../../util/storeHelper';
import {truthy} from '../../../util/util';

import * as Promise from 'bluebird';
import * as _ from 'lodash';

function transfer(info: any, key: string, source: any, path: string[]) {
  const value = getSafe(source, path, undefined);
  if (value !== undefined) {
    info[key] = value;
  }
}

const attributeExtractors: Array<{ priority: number, extractor: AttributeExtractor}> = [];

export function registerAttributeExtractor(priority: number, extractor: AttributeExtractor) {
  attributeExtractors.push({ priority, extractor });
}

function filterUndefined(input: { [key: string]: any }) {
  return _.omitBy(input, val => val === undefined);
}

function filterModInfo(input: any, modPath: string): Promise<any> {
  return Promise.map(attributeExtractors.sort(), extractor => extractor.extractor(input, modPath))
  .then(infoBlobs => {
    return Object.assign({}, ...infoBlobs.map(filterUndefined));
  });
}

export default filterModInfo;
