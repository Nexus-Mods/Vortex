import { log } from './log';

import * as less from 'less';
import LessPluginCleanCSS = require('less-plugin-clean-css');
import * as path from 'path';

let cleanCSSPlugin = new LessPluginCleanCSS({advanced: true});

/**
 * compile and add style sheets from extensions
 * 
 * @param {any} extensions
 */
function loadExtensionCSS(extensions) {
  let stylesheets = [
    'variables',
  ];

  extensions.apply('registerStyle',
                   (filePath: string) => { stylesheets.push(filePath); });

  let lessIndex: string =
      stylesheets.map((name: string) => `@import "${name}";\n`).join('\n');

  less.render(lessIndex,
              {
                filename: path.resolve(__dirname, '..', 'assets', 'css', 'theme.css'),
                plugins: [cleanCSSPlugin],
              },
              (err, output) => {
                if (err !== null) {
                  log('error', 'failed to render css', err.message);
                }
                let style = document.createElement('style');
                style.type = 'text/css';
                style.innerHTML = output.css;
                document.getElementsByTagName('head')[0].appendChild(style);
              });
}

export default loadExtensionCSS;
