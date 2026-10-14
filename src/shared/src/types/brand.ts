import { VortexError } from "../errors/base";

declare const brand: unique symbol;

export type Brand<Base, Tag> = Base & {
  readonly [brand]: { readonly __base__: Base; readonly tag: Tag };
};
type AnyBrand = Brand<unknown, any>;
type BaseOf<B extends AnyBrand> = B[typeof brand]["__base__"];
export type Brander<B extends AnyBrand> = (value: BaseOf<B>) => B;

export function make<B extends AnyBrand>(validate?: (value: BaseOf<B>) => void): Brander<B> {
  return (value: BaseOf<B>): B => {
    validate?.(value);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return value as unknown as B;
  };
}

export function validateNonEmptyString(value: string): void {
  if (value.length > 0) return;
  throw new VortexError("Must be a non-empty string!", {
    kind: "argument-invalid",
    argument: "value",
  });
}
