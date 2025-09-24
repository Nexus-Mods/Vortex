const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const { execFile } = require('child_process');
const execFileAsync = util.promisify(execFile);
// Lazy-load to avoid requiring in non-darwin builds where it isn't used
let notarize;
try {
  // Prefer @electron/notarize (modern, uses notarytool)
  notarize = require('@electron/notarize').notarize;
} catch (e) {
  notarize = null;
}

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
    console.error('❌ Failed to walk', base, err);
  }

  return files;
}

exports.default = async function(context) {

  console.log('📋 createMD5List.js');

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

  // Notarize and staple the app on macOS if credentials are available
  if (process.platform === 'darwin') {
    const appleId = process.env.APPLE_ID;
    const appleIdPassword = process.env.APPLE_ID_PASSWORD; // app-specific password
    const teamId = process.env.APPLE_TEAM_ID;

    // Only attempt notarization if we have the required credentials and library
    if (notarize && appleId && appleIdPassword && teamId) {
      // Derive appPath: prefer packager info, else find first .app in appOutDir
      let appPath;
      try {
        const productName = context?.packager?.appInfo?.productFilename;
        if (productName) {
          appPath = path.join(context.appOutDir, `${productName}.app`);
        }
        if (!appPath) {
          const entries = await fs.readdir(context.appOutDir);
          const appName = entries.find(n => n.endsWith('.app'));
          if (appName) {
            appPath = path.join(context.appOutDir, appName);
          }
        }
      } catch (e) {
        // ignore, will handle undefined appPath below
      }

      if (appPath) {
        console.log(`Submitting for notarization: ${appPath}`);
        try {
          await notarize({
            tool: 'notarytool',
            appPath,
            appleId,
            appleIdPassword,
            teamId,
          });
          console.log('✅ Notarization complete, stapling ticket...');
          await execFileAsync('xcrun', ['stapler', 'staple', '-v', appPath]);
          console.log('✅ Stapling completed');
        } catch (err) {
          console.error('❌ Notarization failed:', err && (err.stack || err.message || err));
          // Re-throw to fail the build when notarization fails
          throw err;
        }
      } else {
        console.warn('⚠️ Could not determine appPath for notarization');
      }
    } else {
      // Fallback: use native notarytool via xcrun if credentials are present
      if (appleId && appleIdPassword && teamId) {
        let appPath;
        try {
          const productName = context?.packager?.appInfo?.productFilename;
          if (productName) {
            appPath = path.join(context.appOutDir, `${productName}.app`);
          }
          if (!appPath) {
            const entries = await fs.readdir(context.appOutDir);
            const appName = entries.find(n => n.endsWith('.app'));
            if (appName) {
              appPath = path.join(context.appOutDir, appName);
            }
          }
        } catch (e) {}

        if (appPath) {
          const zipPath = path.join(context.appOutDir, path.basename(appPath, '.app') + '.zip');
          console.log(`📦 Zipping app for notarization: ${zipPath}`);
          try {
            await execFileAsync('ditto', ['-c', '-k', '--keepParent', appPath, zipPath]);
            console.log('📤 Submitting to Apple Notary Service using notarytool...');
            await execFileAsync('xcrun', [
              'notarytool', 'submit', zipPath,
              '--apple-id', appleId,
              '--password', appleIdPassword,
              '--team-id', teamId,
              '--wait'
            ], { maxBuffer: 10 * 1024 * 1024 });
            console.log('✅ Notarization complete, stapling ticket...');
            await execFileAsync('xcrun', ['stapler', 'staple', '-v', appPath], { maxBuffer: 10 * 1024 * 1024 });
            console.log('Stapling completed');
          } catch (err) {
            console.error('❌ Native notarytool notarization failed:', err && (err.stack || err.message || err));
            throw err;
          } finally {
            try { await fs.unlink(zipPath); } catch (_) {}
          }
        } else {
          console.warn('⚠️ Could not determine appPath for notarization');
        }
      } else {
        console.warn('⚠️ Skipping notarization: missing @electron/notarize or Apple credentials (APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID)');
      }
    }
  }

  return [path.join(assetsPath, 'md5sums.csv')];
}
