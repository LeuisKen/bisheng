import path from 'path';
import webpack from 'webpack';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import context from '../../context';
import getStyleLoadersConfig from './getStyleLoadersConfig';

const bishengLib = path.join(__dirname, '../..');
const bishengLibLoaders = path.join(bishengLib, 'loaders');

export default function updateWebpackConfig(webpackConfig, mode) {
  const { bishengConfig } = context;
  const styleLoadersConfig = getStyleLoadersConfig(bishengConfig);

  /* eslint-disable no-param-reassign */
  webpackConfig.entry = {};
  if (context.isBuild) {
    webpackConfig.output.path = path.join(process.cwd(), bishengConfig.output);
  }
  webpackConfig.output.publicPath = context.isBuild ? bishengConfig.root : '/';
  if (mode === 'dev') {
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
        use: [MiniCssExtractPlugin.loader, ...config.use],
      });
    });
  }
  webpackConfig.module.rules.push({
    test(filename) {
      return (
        filename === path.join(bishengLib, 'placeholders', 'data.js')
        || filename === path.join(bishengLib, 'placeholders', 'ssr-data.js')
      );
    },
    loader: path.join(bishengLibLoaders, 'bisheng-data-loader'),
  });
  /* eslint-enable no-param-reassign */

  const customizedWebpackConfig = bishengConfig.webpackConfig(
    webpackConfig,
    webpack,
  );

  const entryPath = path.join(
    context.tmpDirPath,
    `entry.${bishengConfig.entryName}.js`,
  );
  if (customizedWebpackConfig.entry[bishengConfig.entryName]) {
    throw new Error(
      `Should not set \`webpackConfig.entry.${bishengConfig.entryName}\`!`,
    );
  }
  customizedWebpackConfig.entry[bishengConfig.entryName] = entryPath;

  return customizedWebpackConfig;
}
