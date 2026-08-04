import * as fs from "node:fs";
import * as path from "node:path";

import type { TOptions, i18n, BackendModule, PostProcessorModule, Services } from "i18next";
import I18next from "i18next";
import FSBackend from "i18next-fs-backend";
import { initReactI18next } from "react-i18next";

import type { IExtension } from "../types/extensions";
import getVortexPath from "./getVortexPath";
import translationResources from "./i18n.resources";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: typeof translationResources;
  }
}

/** @public */
export type { i18n };

/** @public */
export type TFunction = typeof I18next.t;

type BrandlessTFunction = Omit<TFunction, "$TFunctionBrand">;

function makeBranded(func: BrandlessTFunction): TFunction {
  func["$TFunctionBrand"] = "common";
  return func as TFunction;
}

export const fallbackTFunc: TFunction = makeBranded((str: string | string[]) => {
  if (Array.isArray(str)) return String(str[0]);
  return String(str);
});

let debugging = false;
let currentLanguage = "en";
let actualT: TFunction = fallbackTFunc;
let missingKeys: Record<string, Record<string, string>> = { common: {} };

type BackendType = "bundled" | "custom" | "extension";

type BackendOptions = {
  bundled: string;
  user: string;
  translationExts: () => IExtension[];
};

class MultiBackend implements BackendModule<BackendOptions> {
  #backendOptions: BackendOptions;
  #backendType: BackendType;
  #currentBackend: FSBackend;
  #lastReadLanguage: string;
  #services: Services;

  static type = "backend" as const;
  type: "backend" = "backend" as const;

  constructor(services: Services, backendOptions: BackendOptions) {
    this.init(services, backendOptions, {});
  }

  init: BackendModule<BackendOptions>["init"] = (services, backendOptions) => {
    this.#backendOptions = backendOptions;
    this.#services = services;
  };

  read: BackendModule["read"] = (language, namespace, callback) => {
    const { backendType, extPath } = this.#getBackendType(language);
    if (
      backendType !== this.#backendType ||
      (backendType === "extension" && language !== this.#lastReadLanguage)
    ) {
      this.#currentBackend = this.initBackend(backendType, extPath);
    }

    this.#lastReadLanguage = language;
    this.#currentBackend.read(language, namespace, callback);
  };

  private initBackend(type: BackendType, extPath: string) {
    const res = new FSBackend();

    let basePath: string;
    if (type === "bundled") {
      basePath = this.#backendOptions.bundled;
    } else if (type === "custom") {
      basePath = this.#backendOptions.user;
    } else {
      basePath = extPath;
    }

    res.init(this.#services, {
      loadPath: path.join(basePath, "{{lng}}", "{{ns}}.json"),
      ident: 2,
    });

    this.#backendType = type;
    return res;
  }

  #getBackendType(language: string): {
    backendType: BackendType;
    extPath?: string;
  } {
    try {
      // translations from the user directory (custom installs or in-development)
      fs.statSync(path.join(this.#backendOptions.user, language));
      return { backendType: "custom" };
    } catch {
      // extension-provided
      const ext = this.#backendOptions.translationExts().find((iter: IExtension) => {
        try {
          fs.statSync(path.join(iter.path, language));
          return true;
        } catch {
          return false;
        }
      });

      if (ext !== undefined) {
        return { backendType: "extension", extPath: ext.path };
      }

      try {
        // finally, see if we have the language bundled
        fs.statSync(path.join(this.#backendOptions.bundled, language));
        return { backendType: "bundled" };
      } catch {
        return { backendType: "custom" };
      }
    }
  }
}

class HighlightPP implements PostProcessorModule {
  name: string = "HighlightPP";

  static type = "postProcessor" as const;
  type: "postProcessor" = "postProcessor" as const;

  process: PostProcessorModule["process"] = (value, key) => {
    if (value.startsWith("TT:")) {
      console.trace("duplicate translation", key, value);
    }

    return "TT:" + value.toUpperCase();
  };
}

/**
 * initialize the internationalization library
 */
export async function init(
  language: string,
  translationExts: () => IExtension[],
): Promise<{ i18n: i18n; tFunc: TFunction; error?: unknown }> {
  // reset to english if the language isn't valid
  try {
    new Date().toLocaleString(language);
  } catch {
    language = "en";
  }

  currentLanguage = language;

  const i18nObj = I18next;
  if (process.env.HIGHLIGHT_I18N === "true") {
    i18nObj.use(new HighlightPP());
  }

  i18nObj.use(MultiBackend).use(initReactI18next);

  try {
    const tFunc = await i18nObj.init({
      // TODO: Remove for i18next version 24
      compatibilityJSON: "v3",

      lng: language,
      fallbackLng: "en",
      fallbackNS: "common",

      resources: translationResources,
      defaultNS: "common",

      nsSeparator: ":::",
      keySeparator: "::",

      debug: false,
      postProcess: process.env.HIGHLIGHT_I18N === "true" ? "HighlightPP" : false,

      react: {
        // afaict this is simply broken at this time. With this enabled the React.Suspense will
        // render the fallback on certain operations after the UI has been started,
        // why I don't know, and that unmounts all components in the dom but it doesn't seem to
        // fire the componentDidUnmount lifecycle functions meaning we can't stop delayed
        // operations that will then break since the component is unmounted
        useSuspense: false,
      },

      saveMissing: debugging,
      saveMissingTo: "current",

      missingKeyHandler: (_, ns, key) => {
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
      } satisfies BackendOptions,
    });

    actualT = tFunc;
    return {
      i18n: i18nObj,
      tFunc,
    };
  } catch (err) {
    actualT = fallbackTFunc;
    return {
      i18n: i18nObj,
      tFunc: fallbackTFunc,
      error: err,
    };
  }
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function changeLanguage(lng: string, cb?: (err: Error) => void): Promise<TFunction> {
  currentLanguage = lng;
  return I18next.changeLanguage(lng, cb);
}

export function globalT(key: string | string[], options: TOptions) {
  return actualT(key, options);
}

export function debugTranslations(enable?: boolean) {
  debugging = enable !== undefined ? enable : !debugging;
  missingKeys = { common: {} };
  init(I18next.language, () => []).catch(() => {});
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

  constructor(key: string, options: TOptions, namespace: keyof typeof translationResources) {
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

export const laterT: TFunction = makeBranded(
  (key: string, optionsOrDefault?: TOptions | string, options?: TOptions): ITString => {
    if (typeof optionsOrDefault === "string") {
      return new TString(key, options, "common");
    } else {
      return new TString(key, optionsOrDefault, "common");
    }
  },
);

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
