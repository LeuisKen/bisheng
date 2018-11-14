import path from 'path';
import webpack from 'webpack';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import {injectDataRules} from 'bisheng-core/lib/config/injectDataRules';
import context from 'bisheng-core/lib/context';
import getStyleLoadersConfig from './getStyleLoadersConfig';

const bishengLib = path.join(__dirname, '..');
const bishengLibLoaders = path.join(bishengLib, 'loaders');

export default function updateWebpackConfig(webpackConfig, mode) {
  const { bishengConfig } = context;
  const styleLoadersConfig = getStyleLoadersConfig(bishengConfig.postcssConfig);

  /* eslint-disable no-param-reassign */
  webpackConfig.entry = {};
  if (context.isBuild) {
    webpackConfig.output.path = path.join(process.cwd(), bishengConfig.output);
  }
  webpackConfig.output.publicPath = context.isBuild ? bishengConfig.root : '/';
  if (mode === 'start') {
    styleLoadersConfig.forEach((config) => {
      webpackConfig.module.rules.push({
        test: config.test,
        use: ['style-loader', ...config.use],
      });
    });
  }
  if (mode === 'build') {
    styleLoadersConfig.forEach((config) => {
      webpackConfig.module.rules.push({
        test: config.test,
        use: ExtractTextPlugin.extract({
          use: config.use,
        }),
      });
    });
  }
  injectDataRules(webpackConfig);
  /* eslint-enable no-param-reassign */

  const customizedWebpackConfig = bishengConfig.webpackConfig(webpackConfig, webpack);

  const entryPath = path.join(bishengLib, '..', 'tmp', `entry.${bishengConfig.entryName}.js`);
  if (customizedWebpackConfig.entry[bishengConfig.entryName]) {
    throw new Error(`Should not set \`webpackConfig.entry.${bishengConfig.entryName}\`!`);
  }
  customizedWebpackConfig.entry[bishengConfig.entryName] = entryPath;
  return customizedWebpackConfig;
}
