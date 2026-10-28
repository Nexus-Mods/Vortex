import { readFileSync } from "node:fs";
import path from "node:path";

import i18next, { type i18n } from "i18next";
import { initReactI18next } from "react-i18next";

/**
 * An i18next instance with the app's English strings of one namespace, set up as the app sets
 * i18next up, so a test can check the text the user sees. Pass it to `I18nextProvider` for
 * components, or use its `t`.
 */
export async function createTestI18n(namespace: string): Promise<i18n> {
  const strings: unknown = JSON.parse(
    readFileSync(path.join(__dirname, "../../../../locales/en", `${namespace}.json`), "utf8"),
  );
  const instance = i18next.createInstance().use(initReactI18next);
  await instance.init({
    lng: "en",
    compatibilityJSON: "v3",
    keySeparator: "::",
    nsSeparator: ":::",
    ns: [namespace],
    defaultNS: namespace,
    interpolation: { escapeValue: false },
    resources: { en: { [namespace]: strings as Record<string, unknown> } },
  });
  return instance;
}
