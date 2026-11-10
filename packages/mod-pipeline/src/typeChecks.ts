/** true when each of A and B is assignable to the other. */
export type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Compiles only when T is true. */
export type Assert<T extends true> = T;
