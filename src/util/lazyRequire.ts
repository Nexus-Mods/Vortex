import * as reqResolve from 'resolve';

export default function<T>(delayed: () => T, exportId?: string): T {
  const handler = {
    get(target, name) {
      if (target.mod === undefined) {
        target.mod = delayed();
      }
      if (exportId !== undefined) {
        return target.mod[exportId][name];
      } else {
        return target.mod[name];
      }
    },
  };
  return new Proxy({}, handler);
}
