const fs = require('fs-extra');
const os = require('os');
const path = require('path');

async function run() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vortex-7z-'));
  const src = path.join(tmp, 'src');
  const dst = path.join(tmp, 'dst');
  const archive = path.join(tmp, 'test.7z');

  await fs.ensureDir(src);
  await fs.ensureDir(dst);
  await fs.writeFile(path.join(src, 'a.txt'), 'hello');
  await fs.writeFile(path.join(src, 'b.txt'), 'world');

  const seven = require('node-7z');
  const getAdd = () => {
    if (typeof seven.add === 'function') return seven.add;
    const Ctor = seven.default || seven;
    const inst = typeof Ctor === 'function' ? new Ctor() : null;
    if (!inst) throw new Error('node-7z add not available');
    return (a, f, o) => inst.add(a, f, o);
  };
  const getExtract = () => {
    if (typeof seven.extractFull === 'function') return seven.extractFull;
    const Ctor = seven.default || seven;
    const inst = typeof Ctor === 'function' ? new Ctor() : null;
    if (!inst) throw new Error('node-7z extractFull not available');
    return (a, d, o) => inst.extractFull(a, d, o);
  };

  // Create archive
  const add = getAdd();
  const addStream = add(archive, [path.join(src, 'a.txt'), path.join(src, 'b.txt')], { ssw: true });
  if (typeof addStream?.promise === 'function') {
    await addStream.promise();
  }

  // Extract archive
  const extract = getExtract();
  const exStream = extract(archive, dst, { ssc: true });
  if (typeof exStream?.promise === 'function') {
    await exStream.promise();
  }

  const files = await fs.readdir(dst);
  console.log('Extracted files:', files.join(', '));
  if (!files.includes('a.txt') || !files.includes('b.txt')) {
    throw new Error('Extraction missing files');
  }
  console.log('OK');
}

run().catch(e => {
  console.error('ERROR', e?.message || e);
  process.exit(1);
});