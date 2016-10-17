import i18n = require('i18next');
import FSBackend = require('i18next-node-fs-backend');

import * as path from 'path';

let dirName = path.dirname(__dirname);
if (dirName.endsWith('.asar')) {
  // locales are not packed so users can update/change them
  dirName = path.dirname(dirName);
}

const basePath = path.normalize(path.join(dirName, 'locales'));

/**
 * initialize the internationalization library
 * 
 * @export
 * @param {string} language
 * @returns {I18next.I18n}
 */
export default function (language: string): I18next.I18n {
  return i18n
    .use(FSBackend)
    .init({
      lng: language,
      fallbackLng: 'en',

      ns: ['common'],
      defaultNS: 'common',

      debug: false,

      saveMissing: false,

      interpolation: {
        escapeValue: false,
      },

      backend: {
        loadPath: path.join(basePath, '{{lng}}', '{{ns}}.json'),
        addPath: path.join(basePath, '{{lng}}', '{{ns}}.missing.json'),
      },
    });
}
