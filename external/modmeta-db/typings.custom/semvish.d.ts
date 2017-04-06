declare module 'semvish' {
  export function compare(v1: string, v2: string);
  export function rcompare(v1: string, v2: string);

  export function gt(v1: string, v2: string);
  export function lt(v1: string, v2: string);
  export function eq(v1: string, v2: string);
  export function neq(v1: string, v2: string);
  export function gte(v1: string, v2: string);
  export function lte(v1: string, v2: string);
  export function cmp(v1: string, comparator: string, v2: string);

  export function clean(version: string, loose: boolean);
  export function valid(version: string);
  export function satisfies(version: string, range: string, loose: boolean);
}