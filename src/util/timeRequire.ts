// tslint:disable

let requires = {};
let total = 0;
let callCount = 0;
let reqCount = 0;

const Module = require('module');

function timedRequire(orig) {
  return function (id) {
    callCount = callCount + 1;
    let before = Date.now();
    let totalBefore = total;
    let countBefore = callCount;

    let res = orig.apply(this, arguments);
    let fullDuration = Date.now() - before;
    let countDiff = callCount - countBefore;

    let selfDuration = fullDuration - (total - totalBefore);
    total = total + selfDuration;

    if (requires[id] === undefined) {
      reqCount = reqCount + 1;
      requires[id] = { selfDuration, fullDuration, countDiff, parent: this || { filename: '' } };
    } else {
      requires[id] = {
        selfDuration: requires[id].selfDuration + selfDuration,
        fullDuration: requires[id].fullDuration + fullDuration,
        countDiff: Math.max(requires[id].countDiff, countDiff),
        parent: requires[id].parent,
      }
    }
    return res;
  };
}

export default function() {
  if (process.env.NODE_ENV !== 'development') {
    return () => undefined;
  }

  let start = Date.now();
  const orig = Module.prototype.require;
  Module.prototype.require = timedRequire(orig);
  return () => {
    Module.prototype.require = orig;
    console.log('total time', Date.now() - start, total);
    console.log('# requires', reqCount);
    console.log(
        'requires:\n',
        Object.keys(requires)
            .filter(r => requires[r].fullDuration > 10)
            .map(r => ({
                   id: r,
                   self: requires[r].selfDuration,
                   full: requires[r].fullDuration,
                   count: requires[r].countDiff,
                 }))
            .sort((lhs, rhs) => lhs.full - rhs.full)
            .map(
                rq =>
                    `${rq.id}, self: ${rq.self} ms, full: ${rq.full} ms, count: ${rq.count}, parent: ${requires[rq.id].parent.filename}`)
            .join('\n'));

    requires = {};
    total = 0;
    callCount = 0;
    reqCount = 0;
  };
};
