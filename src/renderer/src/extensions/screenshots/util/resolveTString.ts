import type { ITString, TFunction } from "@/util/i18n";

export const resolveTString = (t: TFunction, input: string | ITString | undefined): string => {
  if (input === undefined) return "";
  if (typeof input === "string") return input;
  return String(t(input.key, input.options));
};
