import { log } from './log';

import * as sass from 'node-sass';
import * as path from 'path';

function asarUnpacked(input) {
  return input.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
}

/**
 * compile and add style sheets from extensions
 *
 * @param {any} extensions
 */
function loadExtensionCSS(extensions) {
  const stylesheets = [
    'variables',
  ];

  extensions.apply('registerStyle',
    (filePath: string) => stylesheets.push(asarUnpacked(filePath)));

  const sassIndex: string =
      stylesheets.map((name: string) => `@import "${name.replace(/\\/g, '\\\\')}";\n`).join('\n');

  const assetsPath = path.resolve(asarUnpacked(__dirname), '..', 'assets', 'css');

  sass.render({
                outFile: path.join(assetsPath, 'theme.css'),
                includePaths: [ assetsPath ],
                data: sassIndex,
              },
              (err, output) => {
                if (err !== null) {
                  log('error', 'failed to render css', err.message);
                } else {
                  const style = document.createElement('style');
                  style.type = 'text/css';
                  style.innerHTML = output.css;
                  document.getElementsByTagName('head')[0].appendChild(style);
                }
              });
}

export default loadExtensionCSS;
