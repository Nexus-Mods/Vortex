import { setdefault } from './util';

/**
 * Provide context during batch operations
 * This is a generic system that allows operations to find out if they are run in a batch
 * (same operation on multiple selected items) and then get/set information to be remembered
 * for all items.
 * The most obvious use is a "Do this for all x items" checkbox on a dialog.
 *
 * The contexts are global, keyed by an identifier for the operation and the items they act upon.
 * At any point the operation intends to act differently for batch actions, it can determine
 * if this item is part of a batch, fetch the context and query or set arbitrary variables for it.
 * Thus the creation of the context merely declares that it is a batch action, it
 * says nothing on if/how the context is used.
 * The code implementing the operation itself decides if it wants to do anything special with
 * a context and what kind of data it needs to store for that.
 *
 * It's safe to create a context for any batch operation even if there are no current plans
 * to use it and it's safe to write operations to support batch contexts even if the trigger
 * is not yet built to create one.
 * All code has to be written in a way that works without a batch context anyway because every
 * operation can be run on a single item.
 * !!! All intermediate functions/events do not need to be changed at all
 *
 * !!! The combination of operation+item id has to be unique though, as in: the same item can't
 * appear in a multiple batches for the same operation.
 * For example: if a user reinstalls 10 files in a batch they have control inside Vortex while
 * the mods are being reinstalled one by one.
 * They could now trigger _another_ batch-reinstall including one of the mods already processed
 * in the first batch.
 * The context system will delay/queue the entire second batch until the entire first batch is
 * complete, thereby enforcing an order that didn't exist before.
 * For the most part this should not have a noticeable effect for the user.
 */

export interface IBatchContext {
  itemCount: number;
  get<T = any>(varName: string, fallback?: T): T;
  set<T>(varName: string, value: T);
  onClose(cb: (context: BatchContext) => void): void;
}

class BatchContext implements IBatchContext {
  private mCloseCBs: Array<(context: BatchContext) => void> = [];
  private mId: string;
  private mKeys: string[];
  private mValues: { [name: string]: any } = {};
  private mCompletion: Promise<void>;

  constructor(id: string, keys: string[]) {
    this.mId = id;
    this.mKeys = keys;
    this.mCompletion = new Promise<void>(resolve => {
      this.onClose(() => resolve());
    });
  }

  public get itemCount() {
    return this.mKeys.length;
  }

  public await(): Promise<void> {
    return this.mCompletion;
  }

  public get<T = any>(varName: string, fallback?: T): T {
    return this.mValues[varName] ?? fallback;
  }

  public set<T>(varName: string, value: T) {
    this.mValues[varName] = value;
  }

  public close() {
    this.mCloseCBs.forEach(cb => cb(this));
  }

  public onClose(cb: (context: BatchContext) => void) {
    this.mCloseCBs.push(cb);
  }
}

const contexts: { [keyId: string]: BatchContext[] } = {};

function makeKey(id: string, key: string) {
  return `${id}-${key}`;
}

function previousBatch(keys: string[], context: BatchContext): BatchContext {
  for (const key of keys) {
    if ((contexts[key] !== undefined) && (contexts[key][0] !== context)) {
      return contexts[key][0];
    }
  }
  return undefined;
}

export function getBatchContext(operation: string, key: string): IBatchContext {
  const res = contexts[makeKey(operation, key)];
  if (res !== undefined) {
    return res[0];
  } else {
    return undefined;
  }
}

export async function withBatchContext<T>(operation: string,
                                          keys: string[],
                                          cb: () => PromiseLike<T>)
                                          : Promise<T> {
  const context = new BatchContext(operation, keys);

  const fullKeys = keys.map(key => makeKey(operation, key));

  for (const key of fullKeys) {
    setdefault(contexts, key, []).push(context);
  }

  // ensure we're not processing another batch of the same operation including this key
  // concurrently
  // This is necessary as the contexts are globals, fortunately it should be really rare
  // this becomes relevant
  let preBatch: BatchContext = previousBatch(fullKeys, context);
  while (preBatch !== undefined) {
    await preBatch.await();
    preBatch = previousBatch(fullKeys, context);
  }

  let res: T;
  try {
    res = await cb();
  } finally {
    context.close();
    fullKeys.forEach(key => {
      const idx = contexts[key].indexOf(context);
      // idx should *always* be 0 at this point, the block above ensures we only run a batch
      // when it's at idx 0 for all keys
      contexts[key].splice(idx, idx + 1);
    });
  }
  return res;
}
