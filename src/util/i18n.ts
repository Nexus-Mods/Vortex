import { IExtension } from '../extensions/extension_manager/types';

import * as fs from './fs';
import getVortexPath from './getVortexPath';
import { log } from './log';

import Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import I18next, { i18n, TOptions } from 'i18next';
import FSBackend from 'i18next-node-fs-backend';
import * as path from 'path';
import { initReactI18next } from 'react-i18next';

type TFunction = typeof I18next.t;

const app = remote !== undefined ? remote.app : appIn;

let debugging = false;
let currentLanguage = 'en';
const fallbackTFunc: TFunction =
  str => (Array.isArray(str) ? str[0].toString() : str.toString()) as any;

export { fallbackTFunc, i18n, TFunction };

let missingKeys = { common: {} };

export interface IInitResult {
  i18n: i18n;
  tFunc: TFunction;
  error?: Error;
}

type BackendType = 'bundled' | 'custom' | 'extension';

class MultiBackend {
  private static type = 'backend';
  private mOptions: any;
  private mServices: any;
  private mCurrentBackend: FSBackend;
  private mBackendType: BackendType;

  constructor(services, options) {
    this.init(services, options);
  }

  public init(services, options) {
    this.mOptions = options;
    this.mServices = services;
  }

  public read(language: string, namespace: string, callback) {
    const {backendType, extPath} = this.backendType(language);
    if (backendType !== this.mBackendType) {
      this.mCurrentBackend = this.initBackend(backendType, extPath);
    }
    this.mCurrentBackend.read(language, namespace, callback);
  }

  private initBackend(type: BackendType, extPath: string) {
    const res = new FSBackend();

    let basePath: string;
    if (type === 'bundled') {
      basePath = this.mOptions.bundled;
    } else if (type === 'custom') {
      basePath = this.mOptions.user;
    } else {
      basePath = extPath;
    }

    res.init(this.mServices, {
      loadPath: path.join(basePath, '{{lng}}', '{{ns}}.json'),
      jsonIndent: 2,
    });

    return res;
  }

  private backendType(language: string): { backendType: BackendType, extPath?: string } {
    try {
      // translations from the user directory (custom installs or in-development)
      fs.statSync(path.join(this.mOptions.user, language));
      return { backendType: 'custom' };
    } catch (err) {
      // extension-provided
      const ext = this.mOptions.translationExts().find((iter: IExtension) => {
        try {
          fs.statSync(path.join(iter.path, language));
          return true;
        } catch (err) {
          return false;
        }
      });
      if (ext !== undefined) {
        return { backendType: 'extension', extPath: ext.path };
      }

      try {
        // finally, see if we have the language bundled
        fs.statSync(path.join(this.mOptions.bundled, language));
        return { backendType: 'bundled' };
      } catch (err) {
        return { backendType: 'custom' };
      }
    }
  }
}

class HighlightPP {
  public name: string;
  public type: 'postProcessor';

  constructor() {
    this.type = 'postProcessor';
    this.name = 'HighlightPP';
  }

  public process(value: string, key, options, translator) {
    if (value.startsWith('TT:')) {
      console.trace('duplicate translation', key, value);
    }
    return 'TT:' + value.toUpperCase();
  }
}

/**
 * initialize the internationalization library
 *
 * @export
 * @param {string} language
 * @returns {I18next.I18n}
 */
function init(language: string, translationExts: () => IExtension[]): Promise<IInitResult> {
  // reset to english if the language isn't valid
  try {
    new Date().toLocaleString(language);
  } catch (err) {
    language = 'en';
  }

  currentLanguage = language;

  const i18nObj = I18next;
  if (process.env.HIGHLIGHT_I18N === 'true') {
    i18nObj.use(new HighlightPP());
  }
  i18nObj.use(MultiBackend as any)
    .use(initReactI18next)
    ;

  return Promise.resolve(i18nObj.init(
    {
      lng: language,
      fallbackLng: 'en',
      fallbackNS: 'common',

      ns: ['common'],
      defaultNS: 'common',

      nsSeparator: ':::',
      keySeparator: '::',

      debug: false,
      postProcess: (process.env.HIGHLIGHT_I18N === 'true') ? 'HighlightPP' : false,

      react: {
        // afaict this is simply broken at this time. With this enabled the React.Suspense will
        // render the fallback on certain operations after the UI has been started,
        // why I don't know, and that unmounts all components in the dom but it doesn't seem to
        // fire the componentDidUnmount lifecycle functions meaning we can't stop delayed
        // operations that will then break since the component is unmounted
        useSuspense: false,
      } as any,

      saveMissing: debugging,
      saveMissingTo: 'current',

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
        bundled: getVortexPath('locales'),
        user: path.normalize(path.join(app.getPath('userData'), 'locales')),
        translationExts,
      },
    }))
    .then(tFunc => Promise.resolve({
      i18n: i18nObj,
      tFunc,
    }))
    .catch((error) => ({
      i18n: i18nObj,
      tFunc: fallbackTFunc,
      error,
    }));
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function globalT(key: string | string[], options: TOptions) {
  return fallbackTFunc(key, options);
}

export function debugTranslations(enable?: boolean) {
  debugging = (enable !== undefined)
    ? enable
    : !debugging;
  missingKeys = { common: {} };
  init(I18next.language, () => []);
}

export function getMissingTranslations() {
  return missingKeys;
}

export default init;
