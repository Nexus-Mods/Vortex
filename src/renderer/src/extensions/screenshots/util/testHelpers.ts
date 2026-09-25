import { expect } from "vitest";

import type { ITString } from "../../../util/i18n";

export const expectTString = (
  value: string | ITString | undefined,
  key: string,
  options?: Record<string, unknown>,
) => {
  expect(typeof value).not.toBe("string");
  const ts = value as ITString;
  expect(ts.key).toBe(key);
  if (options) expect(ts.options).toMatchObject(options);
};
