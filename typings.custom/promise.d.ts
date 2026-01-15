// TS doesn't support the catch function right now, so we manually fiorce the unknown type
// https://github.com/microsoft/TypeScript/issues/45602
interface Promise<T> {
  then<TFul, TRej = never>(
    onfulfilled?: ((value: T) => TFul | PromiseLike<TFul>) | null,
    onrejected?: ((reason: unknown) => TRej | PromiseLike<TRej>) | null,
  ): Promise<TFul | TRej>;

  catch<TRej = never>(
    onrejected?: ((reason: unknown) => TRej | PromiseLike<TRej>) | null,
  ): Promise<T | TRej>;
}
