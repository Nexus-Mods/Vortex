/** A mod attribute as text: a string as it is, a number written out; none for anything else. */
export const attributeText = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number" ? String(value) : undefined;
