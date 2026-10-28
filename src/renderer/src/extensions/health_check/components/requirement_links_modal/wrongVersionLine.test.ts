import { readFileSync } from "node:fs";
import path from "node:path";

import i18next, { type TFunction } from "i18next";
import { beforeAll, describe, expect, it } from "vitest";

import type { IWrongVersion } from "../../utils/requirementLinks/requirementLinks";
import { wrongVersionLine } from "./wrongVersionLine";

let t: TFunction;

// the app's English strings, set up as the app sets i18next up
beforeAll(async () => {
  const strings: unknown = JSON.parse(
    readFileSync(path.join(__dirname, "../../../../../../../locales/en/health_check.json"), "utf8"),
  );
  const instance = i18next.createInstance();
  t = await instance.init({
    lng: "en",
    compatibilityJSON: "v3",
    keySeparator: "::",
    nsSeparator: ":::",
    defaultNS: "health_check",
    interpolation: { escapeValue: false },
    resources: { en: { health_check: strings as Record<string, unknown> } },
  });
});

const wrong = (extra: Partial<IWrongVersion> = {}): IWrongVersion => ({
  installed: "1.11.5",
  wanted: { versions: { oldest: "1.12.0", newest: "1.14.0" } },
  differentFile: false,
  ...extra,
});

describe("wrongVersionLine", () => {
  it("gives the installed version and the versions needed", () => {
    expect(wrongVersionLine(wrong(), t)).toBe("Version 1.11.5 installed · needs 1.12.0 to 1.14.0");
  });

  it("gives a single version needed once", () => {
    const line = wrongVersionLine(
      wrong({ wanted: { versions: { oldest: "1.12.0", newest: "1.12.0" } } }),
      t,
    );

    expect(line).toBe("Version 1.11.5 installed · needs 1.12.0");
  });

  it("gives only the versions needed when the installed one isn't known", () => {
    expect(wrongVersionLine(wrong({ installed: undefined }), t)).toBe(
      "Needs version 1.12.0 to 1.14.0",
    );
  });

  it("says the version is wrong when the versions needed aren't known", () => {
    expect(wrongVersionLine(wrong({ wanted: {} }), t)).toBe(
      "The installed version isn't one it accepts",
    );
  });

  it("names the file needed when a different file is installed", () => {
    const named = wrongVersionLine(
      wrong({ differentFile: true, wanted: { fileName: "TweakXL" } }),
      t,
    );
    const unnamed = wrongVersionLine(wrong({ differentFile: true }), t);

    expect(named).toBe("A different file of this mod is installed · needs TweakXL");
    expect(unnamed).toBe("A different file of this mod is installed");
  });
});
