/** Span attributes as they are assembled, before the absent ones are dropped. */
export type SpanAttributes = Record<string, string | number | boolean | undefined>;

/** The attributes that carry a value, which is all recordErrorSpan accepts. */
export function definedAttributes(
  attributes: SpanAttributes,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(attributes).filter(
      (entry): entry is [string, string | number | boolean] => entry[1] !== undefined,
    ),
  );
}
