# Migrating from Bluebird to native Promises

## Notice: Removing Bluebird from APIs

Vortex is moving away from Bluebird internally and will be removing Bluebird entirely from the public APIs. Here's what you need to know:

Values going out of Vortex (return types) will change from `Bluebird<T>` to `Promise<T>`:

```typescript
// before
function api(): Bluebird<string>;

// after
function api(): Promise<string>;
```

Values going into Vortex (parameters) will change from `Bluebird<T>` to `PromiseLike<T>`:

```typescript
// before
function api(promise: Bluebird<void>): void;

// after
function api(promise: PromiseLike<void>): void;
```

## Instance Methods

Methods available on Bluebird promise instances.

| Method                        | Description                                                                      | Native Promise Equivalent                                         |
| ----------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `then`                        | Chains promises with fulfillment and rejection handlers, returning a new promise | `then`                                                            |
| `catch`                       | Handles rejections with optional error filtering by type or predicate            | `catch`                                                           |
| `caught`                      | Alias for catch method                                                           | `catch`                                                           |
| `error`                       | Catches only explicit rejections, not thrown errors                              |                                                                   |
| `finally`                     | Executes handler regardless of promise outcome without modifying the value       | `finally`                                                         |
| `lastly`                      | Alias for finally method                                                         | `finally`                                                         |
| `bind`                        | Binds promise handlers to a specific context value                               |                                                                   |
| `done`                        | Executes handlers and throws unhandled rejections as errors                      |                                                                   |
| `tap`                         | Executes side effects on fulfillment without modifying the value                 | `.then(v => { fn(v); return v; })`                                |
| `tapCatch`                    | Executes side effects on rejection with optional error filtering                 | `.catch(e => { fn(e); throw e; })`                                |
| `delay`                       | Postpones promise resolution by specified milliseconds                           | `.then(v => new Promise(r => setTimeout(() => r(v), ms)))`        |
| `timeout`                     | Rejects if promise doesn't settle within specified time                          | `Promise.race([p, new Promise((_, rej) => setTimeout(rej, ms))])` |
| `nodeify`                     | Registers Node.js-style callback on promise                                      |                                                                   |
| `asCallback`                  | Alias for nodeify method                                                         |                                                                   |
| `isFulfilled`                 | Checks if promise has been fulfilled                                             |                                                                   |
| `isRejected`                  | Checks if promise has been rejected                                              |                                                                   |
| `isPending`                   | Checks if promise is still pending                                               |                                                                   |
| `isCancelled`                 | Checks if promise has been cancelled                                             |                                                                   |
| `isResolved`                  | Checks if promise is settled (fulfilled or rejected)                             |                                                                   |
| `value`                       | Retrieves fulfillment value synchronously                                        |                                                                   |
| `reason`                      | Retrieves rejection reason synchronously                                         |                                                                   |
| `reflect`                     | Returns inspection object of promise state                                       | `Promise.allSettled([p])` (per-item `{status, value/reason}`)     |
| `call`                        | Invokes a method on the promise's resolved value                                 | `.then(obj => obj.method())`                                      |
| `get`                         | Accesses a property on the promise's resolved value                              | `.then(obj => obj.prop)`                                          |
| `return`                      | Resolves with a specified value                                                  | `.then(() => value)`                                              |
| `thenReturn`                  | Alias for return method                                                          | `.then(() => value)`                                              |
| `throw`                       | Rejects with specified error                                                     | `.then(() => { throw err; })`                                     |
| `thenThrow`                   | Alias for throw method                                                           | `.then(() => { throw err; })`                                     |
| `catchReturn`                 | Returns value on rejection with optional filtering                               | `.catch(() => value)`                                             |
| `catchThrow`                  | Rethrows or throws error on rejection with optional filtering                    | `.catch(() => { throw err; })`                                    |
| `toString`                    | Converts promise to string representation                                        |                                                                   |
| `toJSON`                      | Serializes promise for JSON                                                      |                                                                   |
| `spread`                      | Flattens array fulfillment value into handler parameters                         | `.then(([a, b]) => ...)`                                          |
| `all`                         | Waits for all array items to resolve                                             | `.then(arr => Promise.all(arr))`                                  |
| `props`                       | Waits for all object properties to resolve                                       | `.then(obj => Promise.all(Object.entries(obj).map(...)))`         |
| `any`                         | Fulfills with first resolved value from iterable                                 | `.then(arr => Promise.any(arr))`                                  |
| `some`                        | Fulfills when specified count of promises resolve                                |                                                                   |
| `race`                        | Fulfills with first settled promise from iterable                                | `.then(arr => Promise.race(arr))`                                 |
| `map`                         | Transforms array items with mapper function                                      | `.then(arr => Promise.all(arr.map(fn)))`                          |
| `reduce`                      | Aggregates array items with reducer function                                     |                                                                   |
| `filter`                      | Filters array items based on predicate                                           | `.then(arr => Promise.all(arr.map(fn))).then(...)` then filter    |
| `each`                        | Iterates array items for side effects                                            | `.then(arr => Promise.all(arr.map(fn)))` (parallel)               |
| `mapSeries`                   | Transforms array items sequentially                                              |                                                                   |
| `cancel`                      | Cancels the promise if cancellation is enabled                                   |                                                                   |
| `suppressUnhandledRejections` | Prevents unhandled rejection reporting                                           |                                                                   |
| `disposer`                    | Creates resource cleanup wrapper for using pattern                               |                                                                   |

## Static Methods

Methods available on the Bluebird namespace/constructor.

| Method                         | Description                                                      | Native Promise Equivalent                                                                                             |
| ------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `try`                          | Executes function and wraps result in promise                    | `Promise.resolve().then(fn)`                                                                                          |
| `attempt`                      | Alias for try method                                             | `Promise.resolve().then(fn)`                                                                                          |
| `method`                       | Wraps function to always return a promise                        | `(...args) => Promise.resolve().then(() => fn(...args))`                                                              |
| `resolve`                      | Creates fulfilled promise with value                             | `Promise.resolve`                                                                                                     |
| `reject`                       | Creates rejected promise with reason                             | `Promise.reject`                                                                                                      |
| `defer`                        | Creates promise with external resolver (deprecated)              | `new Promise((resolve, reject) => { ... })`                                                                           |
| `cast`                         | Converts thenable or value to trusted promise                    | `Promise.resolve`                                                                                                     |
| `bind`                         | Creates void promise bound to context                            |                                                                                                                       |
| `is`                           | Checks if value is trusted promise                               | `value instanceof Promise` (not identical semantics)                                                                  |
| `longStackTraces`              | Enables long stack trace collection                              |                                                                                                                       |
| `delay`                        | Returns promise that resolves after milliseconds                 | `new Promise(r => setTimeout(r, ms))`                                                                                 |
| `promisify`                    | Converts Node.js callback function to promise-returning function | `util.promisify` (Node.js)                                                                                            |
| `promisifyAll`                 | Converts object methods to async variants                        |                                                                                                                       |
| `fromNode`                     | Creates promise from Node.js callback function                   | `new Promise((resolve, reject) => fn(cb))`                                                                            |
| `fromCallback`                 | Alias for fromNode method                                        | `new Promise((resolve, reject) => fn(cb))`                                                                            |
| `coroutine`                    | Wraps generator function for async execution                     | `async`/`await`                                                                                                       |
| `onPossiblyUnhandledRejection` | Registers unhandled rejection handler                            | `process.on('unhandledRejection', ...)` (Node) / `window.addEventListener('unhandledrejection', ...)`                 |
| `all`                          | Fulfills when all promises in array resolve                      | `Promise.all`                                                                                                         |
| `allSettled`                   | Waits for all promises regardless of outcome                     | `Promise.allSettled`                                                                                                  |
| `props`                        | Fulfills when all object properties resolve                      | `Promise.all(Object.entries(obj).map(([k, v]) => Promise.resolve(v).then(val => [k, val]))).then(Object.fromEntries)` |
| `any`                          | Fulfills with first resolved value                               | `Promise.any`                                                                                                         |
| `race`                         | Fulfills with first settled promise                              | `Promise.race`                                                                                                        |
| `some`                         | Fulfills when specified count resolves                           |                                                                                                                       |
| `join`                         | Coordinates multiple promises with handler function              | `Promise.all([p1, p2]).then(([a, b]) => fn(a, b))`                                                                    |
| `map`                          | Transforms iterable items with mapper                            | `Promise.all(items.map(fn))`                                                                                          |
| `reduce`                       | Aggregates iterable items with reducer                           |                                                                                                                       |
| `filter`                       | Filters iterable items by predicate                              | `Promise.all(items.map(fn))` then filter                                                                              |
| `each`                         | Iterates iterable for side effects                               | `Promise.all(items.map(fn))` (parallel)                                                                               |
| `mapSeries`                    | Transforms iterable items sequentially                           |                                                                                                                       |
| `using`                        | Manages resource lifecycle with disposers                        |                                                                                                                       |
| `config`                       | Configures library behavior and features                         |                                                                                                                       |
