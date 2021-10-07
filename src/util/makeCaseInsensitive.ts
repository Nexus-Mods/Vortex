function normalize(key: string | symbol): string | symbol {
  return typeof(key) === 'string' ? key.toLowerCase() : key;
}

/**
 * create a case insensitive (in the sense that keys are case insensitive,
 * it doesn't affect values) copy of an object
 * @param input the input data
 */
function makeInsensitive(input: any): any {
  const inputL = Object.keys(input).reduce((prev, key: string) => {
    prev[normalize(key)] = input[key];
    return prev;
  }, {});
  return new Proxy(inputL, {
    has: (target: any, key: string | symbol) =>
      Reflect.has(target, key) || Reflect.has(target, normalize(key)),
    get: (target: any, key: string | symbol) =>
      target[key] !== undefined
      ? target[key]
      : Reflect.get(target, normalize(key)),
    set: (target: any, key: string | symbol, value, receiver) =>
      Reflect.set(target, normalize(key), value, receiver),
    getOwnPropertyDescriptor: (target: any, key: string | symbol) =>
      Reflect.getOwnPropertyDescriptor(target, key)
      || Reflect.getOwnPropertyDescriptor(target, normalize(key)),
    ownKeys: (target: any) =>
      Reflect.ownKeys(target).map(normalize),
  });
}

export default makeInsensitive;
