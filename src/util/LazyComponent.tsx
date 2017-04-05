import * as React from 'react';
import reqResolve = require('resolve');

export default function<T>(moduleId: string, basedir?: string) {
  let mod: {
    default: React.ComponentClass<any>
  };
  return (props) => {
    if (mod === undefined) {
      let options = basedir !== undefined ? { basedir } : undefined;
      mod = require(reqResolve.sync(moduleId, options));
    }
    return <mod.default {...props} />;
  };
}
