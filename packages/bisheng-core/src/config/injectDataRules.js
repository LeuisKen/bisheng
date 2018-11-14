const path = require('path');

const bishengCoreLib = path.join(__dirname, '..');
const bishengCoreLibLoaders = path.join(bishengCoreLib, 'loaders');

export function injectDataRules(webpackConfig) {

  webpackConfig.module.rules.push({
    test(filename) {
      return filename === path.join(bishengCoreLib, 'placeholders', 'data.js') ||
        filename === path.join(bishengCoreLib, 'placeholders', 'ssr-data.js');
    },
    loader: path.join(bishengCoreLibLoaders, 'bisheng-data-loader'),
  });

}
