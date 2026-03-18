/**
 * create a global variable that is available through an id.
 * This is basically a hack to get around the fact js can't have
 * proper singletons.
 */
function local<T>(id: string, init: T): T {
  const sym = Symbol.for(id);

  if (global[sym] === undefined) {
    global[sym] = init;
  }

  return global[sym];
}

export default local;
