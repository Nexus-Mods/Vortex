import asyncRequire from './asyncRequire';

import * as React from 'react';

/**
 * React Component Wrapper for async require. This requires the
 * component asynchronously (assuming it's the default export),
 * showing nothing until loading is finished.
 *
 * @export
 * @template T
 * @param {string} moduleId
 * @param {string} [basedir]
 * @returns
 */
export default function<T>(moduleId: string, basedir?: string) {
  let mod: {
    default: React.ComponentClass<any>,
  };

  asyncRequire(moduleId, basedir)
  .then(modIn => mod = modIn);

  return (props) => {
    if (mod === undefined) {
      return null;
    }
    return <mod.default {...props} />;
  };
}
