const REQUIRE_MAP = {
  'fs': 'original-fs',
}

// tslint:disable-next-line:no-var-requires
const Module = require('module');

function patchedLoad(orig) {
  // tslint:disable-next-line:only-arrow-functions
  return function(request: string, ...rest) {
    request = REQUIRE_MAP[request] || request;
    return orig.apply(this, [request, ...rest]);
  };
}

export default function() {
  const orig = (Module as any)._load;
  (Module as any)._load = patchedLoad(orig);
  return () => {
    (Module as any)._load = orig;
  }
}
