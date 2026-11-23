import { describe, expect, it } from "vitest";

import type { INotification } from "@/types/INotification";

import { toastMessage } from "./toastMessage";

const german: Record<string, string> = {
  Timeout: "Zeitüberschreitung",
  "Rating failed, wait {{ waitingTime }}": "Bewertung fehlgeschlagen, warte {{ waitingTime }}",
};

// Looks the key up like i18next would, then fills in `replace`.
const t = (key: string, options?: { replace?: Record<string, string> }) =>
  Object.entries(options?.replace ?? {}).reduce(
    (text, [name, value]) => text.replace(`{{ ${name} }}`, value),
    german[key] ?? key,
  );

const notification = (fields: Partial<INotification>): INotification => ({
  type: "error",
  message: "",
  ...fields,
});

describe("toastMessage", () => {
  it("translates the title and the message, as the bell does", () => {
    expect(toastMessage(notification({ title: "Timeout", message: "Unknown key" }), t)).toBe(
      "Zeitüberschreitung:\nUnknown key",
    );
  });

  it("fills in replace placeholders", () => {
    const noti = notification({
      message: "Rating failed, wait {{ waitingTime }}",
      replace: { waitingTime: "12h" },
    });
    expect(toastMessage(noti, t)).toBe("Bewertung fehlgeschlagen, warte 12h");
  });

  it("leaves a part untranslated when localize turns it off", () => {
    const noti = notification({
      title: "Timeout",
      message: "Timeout",
      localize: { title: false, message: false },
    });
    expect(toastMessage(noti, t)).toBe("Timeout:\nTimeout");
  });

  it("gives an empty string when there is nothing to show", () => {
    expect(toastMessage(notification({}), t)).toBe("");
  });
});
