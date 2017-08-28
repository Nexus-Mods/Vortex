import * as path from 'path';
import * as webpack from 'webpack';

function externalsDirect(): webpack.ExternalsObjectElement {
  return [
    'bluebird',
    'electron',
    'exe-version',
    'ffi',
    'fs',
    'fs-extra-promise',
    'immutability-helper',
    'lodash',
    'minimatch',
    'modmeta-db',
    'nbind',
    'net',
    'node',
    'path',
    'react',
    'react-act',
    'react-bootstrap',
    'react-dnd',
    'react-dnd-html5-backend',
    'react-dom',
    'react-i18next',
    'react-layout-pane',
    'react-redux',
    'ref',
    'request',
    'semver',
    'semvish',
    'util',
    'vortex-api',
  ].reduce((prev, key) => {
    prev[key] = key;
    return prev;
  }, {});
}

export function externals(): webpack.ExternalsElement {
  return {
    ...externalsDirect(),
  };
}

export function output(moduleName: string): webpack.Output {
  return {
    libraryTarget: 'commonjs2',
    library: moduleName,
    filename: 'index.js',
    sourceMapFilename: `${moduleName}.js.map`,
    path: path.resolve(__dirname, 'dist'),
  };
}

export function loaders(): webpack.Rule[] {
  return [
    {test: /\.tsx?$/, loader: 'ts-loader' },
    {test: /\.json$/, loader: 'json-loader'},
  ];
}

export default function config(moduleName: string): webpack.Configuration {
  return {
    entry: './out/index.js',
    target: 'electron-renderer',
    node: {__filename: false, __dirname: false},
    output: output(moduleName),
    module: {
      loaders: loaders(),
    },
    resolve: {extensions: ['.js', '.jsx', '.json', '.ts', '.tsx']},
    externals: externals(),
  };
}
