import reqResolve = require('resolve');

export default function<T>(moduleId: string, basedir?: string, exportId?: string): T {
  const handler = {
    get(target, name) {
      if (target.mod === undefined) {
        const modulePath = reqResolve.sync(
            moduleId, basedir !== undefined ? {basedir} : undefined);
        target.mod = require(modulePath);
      }
      if (exportId !== undefined) {
        return target.mod[exportId][name];
      } else {
        return target.mod[name];
      }
    },
  };
  return new Proxy({}, handler);
};
