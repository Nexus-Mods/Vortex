import i18n = require('i18next');
import FSBackend = require('i18next-node-fs-backend');

import * as path from 'path';

import { log } from './log';

let dirName = path.dirname(__dirname);
if (dirName.endsWith('.asar')) {
  // locales are not packed so users can update/change them
  dirName = path.dirname(dirName);
}

const basePath = path.normalize(path.join(dirName, 'locales'));

let debugging = false;

interface ITranslationEntry {
  lng: string;
  ns: string;
  key: string;
}
let missingKeys = { common: {} };

/**
 * initialize the internationalization library
 * 
 * @export
 * @param {string} language
 * @returns {I18next.I18n}
 */
function init(language: string): I18next.I18n {
  return i18n
    .use(FSBackend)
    .init({
      lng: language,

      ns: ['common'],
      defaultNS: 'common',

      nsSeparator: ':::',
      keySeparator: '::',

      debug: false,

      saveMissing: debugging,

      missingKeyHandler: (lng, ns, key, fallbackValue) => {
        missingKeys[ns][key] = key;
      },

      interpolation: {
        escapeValue: false,
      },

      backend: {
        loadPath: path.join(basePath, '{{lng}}', '{{ns}}.json'),
        addPath: path.join(basePath, '{{lng}}', '{{ns}}.missing.json'),
      },
    });
}

export function debugTranslations(enable?: boolean) {
  if (enable !== undefined) {
    debugging = enable;
  } else {
    debugging = !debugging;
  }
  missingKeys = { common: {} };
  init(i18n.language);
}

export function getMissingTranslations() {
  return missingKeys;
}

export default init;
