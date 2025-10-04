const fs = require('fs-extra');
const path = require('path');

async function run() {
  const root = __dirname + '/..';
  const archive = path.resolve(root, 'test_mod.zip');
  const destRoot = path.resolve(root, 'tmp-extract');
  const destPath = path.join(destRoot, 'test_mod');

  await fs.ensureDir(destPath);

  const seven = require('node-7z');
  const getExtract = () => {
    if (typeof seven.extractFull === 'function') return seven.extractFull;
    const Ctor = seven.default || seven;
    const inst = typeof Ctor === 'function' ? new Ctor() : null;
    if (!inst) throw new Error('node-7z extractFull not available');
    return (a, d, o) => inst.extractFull(a, d, o);
  };

  console.log('Extracting', archive, 'to', destPath);
  const extract = getExtract();
  const exStream = extract(archive, destPath, { ssc: true });
  if (typeof exStream?.promise === 'function') {
    await exStream.promise();
  }

  const files = await fs.readdir(destPath);
  console.log('Extracted entries:', files);
}

run().catch(e => {
  console.error('ERROR', e?.message || e);
  process.exit(1);
});