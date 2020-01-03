const path = require('path');

module.exports = ({ config, mode }) => {
  config.module.rules.push({
    test: /\.(ts|tsx)$/,
    use: [
      {
        loader: require.resolve('babel-loader'),
        options: {
          presets: [['react-app', { flow: false, typescript: true }]],
        },
      },
      'react-docgen-typescript-loader',
    ],
  });
  config.resolve.extensions.push('.ts', '.tsx');

  config.module.rules.push({
    test: /\.(s[ac]ss|eot)$/i,
    use: [
      'style-loader',
      'css-loader',
      {
        loader: 'resolve-url-loader',
        options: {
          debug: true,
          join: (fileName, options) => {
            const bsRoot = path.join('node_modules', 'bootstrap-sass', 'assets', 'stylesheets');

            return (uri) => {
              if (uri.indexOf('fonts/bootstrap') !== -1) {
                return path.resolve(bsRoot, uri);
              }
              return uri;
            }
          }
        }
      },
      {
        loader: 'sass-loader',
        options: {
          sassOptions: {
            includePaths: [
              `../assets`,
              path.join(__dirname, '..', 'node_modules'),
            ],
          }
        },
      }
    ],
  });

  return config;
};
