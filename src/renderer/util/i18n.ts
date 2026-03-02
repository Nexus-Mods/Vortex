import type { TOptions, i18n } from "i18next";

import Bluebird from "bluebird";
import I18next from "i18next";
import FSBackend from "i18next-fs-backend";
import * as path from "path";
import { initReactI18next } from "react-i18next";

import type { IExtension } from "../types/extensions";

import * as fs from "./fs";
import getVortexPath from "./getVortexPath";
import { log } from "./log";

type TFunction = typeof I18next.t;

let debugging = false;
let currentLanguage = "en";
const fallbackTFunc: TFunction = (str) =>
  Array.isArray(str) ? str[0].toString() : str.toString();

let actualT: TFunction = fallbackTFunc;

export { fallbackTFunc };
export type { i18n, TFunction };

let missingKeys = { common: {} };

export interface IInitResult {
  i18n: i18n;
  tFunc: TFunction;
  error?: Error;
}

type BackendType = "bundled" | "custom" | "extension";

class MultiBackend {
  private static type = "backend";
  private mOptions: any;
  private mServices: any;
  private mCurrentBackend: FSBackend;
  private mLastReadLanguage: string;
  private mBackendType: BackendType;

  constructor(services, options) {
    this.init(services, options);
  }

  public init(services, options) {
    this.mOptions = options;
    this.mServices = services;
  }

  public read(language: string, namespace: string, callback): void {
    const { backendType, extPath } = this.backendType(language);
    if (
      backendType !== this.mBackendType ||
      (backendType === "extension" && language !== this.mLastReadLanguage)
    ) {
      this.mCurrentBackend = this.initBackend(backendType, extPath);
    }

    this.mLastReadLanguage = language;
    this.mCurrentBackend.read(language, namespace, callback);
  }

  private initBackend(type: BackendType, extPath: string) {
    const res = new FSBackend();

    let basePath: string;
    if (type === "bundled") {
      basePath = this.mOptions.bundled;
    } else if (type === "custom") {
      basePath = this.mOptions.user;
    } else {
      basePath = extPath;
    }

    res.init(this.mServices, {
      loadPath: path.join(basePath, "{{lng}}", "{{ns}}.json"),
      ident: 2,
    });

    this.mBackendType = type;
    return res;
  }

  private backendType(language: string): {
    backendType: BackendType;
    extPath?: string;
  } {
    try {
      // translations from the user directory (custom installs or in-development)
      fs.statSync(path.join(this.mOptions.user, language));
      return { backendType: "custom" };
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
        return { backendType: "extension", extPath: ext.path };
      }

      try {
        // finally, see if we have the language bundled
        fs.statSync(path.join(this.mOptions.bundled, language));
        return { backendType: "bundled" };
      } catch (err) {
        return { backendType: "custom" };
      }
    }
  }
}

class HighlightPP {
  public name: string;
  public type: "postProcessor";

  constructor() {
    this.type = "postProcessor";
    this.name = "HighlightPP";
  }

  public process(value: string, key, options, translator) {
    if (value.startsWith("TT:")) {
      console.trace("duplicate translation", key, value);
    }
    return "TT:" + value.toUpperCase();
  }
}

/**
 * initialize the internationalization library
 *
 * @export
 * @param {string} language
 * @returns {I18next.I18n}
 */
function init(
  language: string,
  translationExts: () => IExtension[],
): Bluebird<IInitResult> {
  // reset to english if the language isn't valid
  try {
    new Date().toLocaleString(language);
  } catch (err) {
    language = "en";
  }

  currentLanguage = language;

  const i18nObj = I18next;
  if (process.env.HIGHLIGHT_I18N === "true") {
    i18nObj.use(new HighlightPP());
  }
  i18nObj.use(MultiBackend as any).use(initReactI18next);

  return Bluebird.resolve(
    i18nObj.init({
      lng: language,
      fallbackLng: "en",
      fallbackNS: "common",

      ns: [
        "common",
        "collection",
        "mod_management",
        "download_management",
        "profile_management",
        "nexus_integration",
        "gamemode_management",
        "extension_manager",
      ],
      defaultNS: "common",

      nsSeparator: ":::",
      keySeparator: "::",

      debug: false,
      postProcess:
        process.env.HIGHLIGHT_I18N === "true" ? "HighlightPP" : false,

      react: {
        // afaict this is simply broken at this time. With this enabled the React.Suspense will
        // render the fallback on certain operations after the UI has been started,
        // why I don't know, and that unmounts all components in the dom but it doesn't seem to
        // fire the componentDidUnmount lifecycle functions meaning we can't stop delayed
        // operations that will then break since the component is unmounted
        useSuspense: false,
      } as any,

      saveMissing: debugging,
      saveMissingTo: "current",

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
        bundled: getVortexPath("locales"),
        user: path.normalize(path.join(getVortexPath("userData"), "locales")),
        translationExts,
      },
    }),
  )
    .tap((tFunc) => {
      actualT = tFunc;
    })
    .then((tFunc) =>
      Bluebird.resolve({
        i18n: i18nObj,
        tFunc,
      }),
    )
    .catch((error) => ({
      i18n: i18nObj,
      tFunc: fallbackTFunc,
      error,
    }));
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function changeLanguage(
  lng: string,
  cb?: (err: Error) => void,
): Promise<TFunction> {
  currentLanguage = lng;
  return I18next.changeLanguage(lng, cb);
}

export function globalT(key: string | string[], options: TOptions) {
  return actualT(key, options);
}

export function debugTranslations(enable?: boolean) {
  debugging = enable !== undefined ? enable : !debugging;
  missingKeys = { common: {} };
  init(I18next.language, () => []);
}

export function getMissingTranslations() {
  return missingKeys;
}

export interface ITString {
  key: string;
  options?: TOptions;
  toString(): string;
}

export class TString implements ITString {
  private mKey: string;
  private mOptions: TOptions;

  constructor(key: string, options: TOptions, namespace: string) {
    this.mKey = key;
    this.mOptions = options ?? {};
    if (this.mOptions.ns === undefined) {
      this.mOptions.ns = namespace;
    }
  }

  public get key(): string {
    return this.mKey;
  }

  public get options(): TOptions {
    return this.mOptions;
  }

  public toString(): string {
    return this.mKey;
  }
}

export const laterT: TFunction = (
  key: string,
  optionsOrDefault?: TOptions | string,
  options?: TOptions,
): ITString => {
  if (typeof optionsOrDefault === "string") {
    return new TString(key, options, "common");
  } else {
    return new TString(key, optionsOrDefault, "common");
  }
};

/**
 * translate an input string. If key is a string or string array, this just
 * forwards the parameters to the t function.
 * If it is an ITString object, will translate using with the parameters stored
 * within
 * @param t the actual translation function to invok
 * @param key translation key, keys or ITString object
 * @param options translations options. this will take precedence over those specified at
 *                the time the ITString was created
 * @param onlyTString if set to true and the key is a string, assume it's already the translated
 *                    string and don't translate again. This is mostly for backwards compatibility
 */
export function preT(
  t: TFunction,
  key: string | string[] | ITString,
  options?: TOptions,
  onlyTString?: boolean,
) {
  if ([undefined, null].includes(key)) {
    return "";
  }
  if (typeof key === "string") {
    if (onlyTString === true) {
      return key;
    } else {
      return t(key, options);
    }
  } else if (Array.isArray(key)) {
    return t(key, options);
  } else {
    return t(key.key, { ...key.options, ...(options ?? {}) });
  }
}

export default init;
