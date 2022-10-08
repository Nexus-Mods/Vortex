import { AttributeExtractor } from '../../../types/IExtensionContext';

import Bluebird from 'bluebird';
import * as _ from 'lodash';

const attributeExtractors: Array<{ priority: number, extractor: AttributeExtractor}> = [];

export function registerAttributeExtractor(priority: number, extractor: AttributeExtractor) {
  attributeExtractors.push({ priority, extractor });
}

function filterUndefined(input: { [key: string]: any }) {
  return _.omitBy(input, val => val === undefined);
}

function filterModInfo(input: any, modPath: string): Bluebird<any> {
  return Bluebird.map(
    attributeExtractors.sort((lhs, rhs) => rhs.priority - lhs.priority),
    extractor => extractor.extractor(input, modPath),
  ).then(infoBlobs => Object.assign({}, ...infoBlobs.map(filterUndefined)));
}

export default filterModInfo;
