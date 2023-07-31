const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

async function walk(base, rel) {
  let files = [];
  const dirs = [];

  try {
    await Promise.all((await fs.readdir(path.join(base, rel)))
      .map(async name => {
        const stats = await fs.stat(path.join(base, rel, name));
        const rPath = path.join(rel, name);
        if (stats.isDirectory()) {
          dirs.push(rPath);
        } else {
          files.push(rPath);
        }
      }));

    await Promise.all(await dirs.map(async dir => {
      const rec = await walk(base, dir);
      files = [].concat(files, rec);
    }));
  } catch (err) {
    console.error('Failed to walk', base, err);
  }

  return files;
}

exports.default = async function(context) {

  console.log('createMD5List.js');

  const assetsPath = path.join(context.appOutDir, 'resources', 'app.asar.unpacked', 'assets');

  const hashes = await Promise.all((await walk(context.appOutDir, ''))
    .map(async relPath => {
      const hash = crypto.createHash('md5');
      const fileData = await fs.readFile(path.join(context.appOutDir, relPath));
      const buf = hash
        .update(fileData)
        .digest();
      console.log(`${relPath}:${buf.toString('hex')}`);
      return `${relPath}:${buf.toString('hex')}`;
    }));

  try {
    await fs.writeFile(path.join(assetsPath, 'md5sums.csv'), hashes.join('\n'));
  } catch (err) {
    console.error(`Failed to write: ${err.message}`);
  }
  
  console.log(`Successfully wrote ${path.join(assetsPath, 'md5sums.csv')}`);

  return [path.join(assetsPath, 'md5sums.csv')];
}
