import { AttributeExtractor } from '../../../types/IExtensionContext';

import { log } from '../../../util/log';

const attributeExtractors: Array<{ priority: number, extractor: AttributeExtractor}> = [];

export function registerAttributeExtractor(priority: number, extractor: AttributeExtractor) {
  attributeExtractors.push({ priority, extractor });
  attributeExtractors.sort((lhs, rhs) => rhs.priority - lhs.priority);
}

function filterNullish(input: { [key: string]: any }) {
  return Object.fromEntries(Object.entries(input ?? {}).filter(([_, val]) => val != null));
}

// Every mod installation is run through the attributeExtractors in order of priority.
//  Imagine the simplest use case where installing a collection with 1000 mods - and one extractor takes over 1.5 seconds to run,
//  that's at a minimum 25 minutes of waiting for the user. Keep in mind that incorrect usage of the attributeExtractors in community
//  extensions will raise this time even further. This is why we have a timeout of 1 second for each extractor. All core extractors
//  should never take more than a few milliseconds to run.
function extractorOrSkip(extractor: AttributeExtractor, input: any, modPath: string): Promise<any> {
  return Promise.race([
    extractor(input, modPath),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Extractor timed out')), 2000))
  ]).catch(err => {
    const extractorName = extractor.name || extractor.constructor?.name || '[anonymous extractor]';
    log('error', `Extractor skipped: "${extractorName}" (modPath: "${modPath}") - ${err.message}`);
    return {};
  });
}

function filterModInfo(input: any, modPath: string): Promise<any> {
  return Promise.all(attributeExtractors.map(extractor => extractorOrSkip(extractor.extractor, input, modPath)))
    .then(infoBlobs => Object.assign({}, ...infoBlobs.map(filterNullish)));
}

export default filterModInfo;
