import { log } from './log';

import i18n = require('i18next');
import FSBackend = require('i18next-node-fs-backend');

import * as path from 'path';

let dirName = path.dirname(__dirname);
if (dirName.endsWith('.asar')) {
  // locales are not packed so users can update/change them
  dirName = path.dirname(dirName);
}

const basePath = path.normalize(path.join(dirName, 'locales'));
log('info', 'reading localizations', basePath);

let debugging = false;

interface ITranslationEntry {
  lng: string;
  ns: string;
  key: string;
}
let missingKeys = { common: {} };

export interface IInitResult {
  i18n: I18next.I18n;
  tFunc: I18next.TranslationFunction;
  error?: Error;
}

/**
 * initialize the internationalization library
 * 
 * @export
 * @param {string} language
 * @returns {I18next.I18n}
 */
function init(language: string): Promise<IInitResult> {
  return new Promise<IInitResult>((resolve, reject) => {
    const res = i18n.use(FSBackend).init(
        {
          lng: language,
          fallbackLng: 'en',
          fallbackNS: 'common',

          ns: ['common'],
          defaultNS: 'common',

          nsSeparator: ':::',
          keySeparator: '::',

          debug: false,

          saveMissing: debugging,

          missingKeyHandler: (lng, ns, key, fallbackValue) => {
            if (missingKeys[ns] === undefined) {
              missingKeys[ns] = {};
            }
            missingKeys[ns][key] = key;
          },

          interpolation: {
            escapeValue: false,
          },

          backend: {
            loadPath: path.join(basePath, '{{lng}}', '{{ns}}.json'),
            addPath: path.join(basePath, '{{lng}}', '{{ns}}.missing.json'),
          },
        },
        (error, tFunc) => {
          if ((error !== null) && (error !== undefined)) {
            return resolve({ i18n: res, tFunc: str => str, error });
          }
          resolve({ i18n: res, tFunc });
        });
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
