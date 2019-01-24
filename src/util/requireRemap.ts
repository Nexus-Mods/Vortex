// tslint:disable-next-line:no-var-requires
const Module = require('module');

function patchedLoad(orig) {
  // tslint:disable-next-line:only-arrow-functions
  return function(request: string, parent, ...rest) {
    if ((request === 'fs')
        && ((parent.filename.indexOf('graceful-fs') !== -1)
            || (parent.filename.indexOf('rimraf') !== -1))) {
      request = 'original-fs';
    }
    return orig.apply(this, [request, parent, ...rest]);
  };
}

export default function() {
  const orig = (Module as any)._load;
  (Module as any)._load = patchedLoad(orig);
  return () => {
    (Module as any)._load = orig;
  }
}
