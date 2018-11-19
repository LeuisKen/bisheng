import * as path from 'path';
import rucksack from 'rucksack-css';
import autoprefixer from 'autoprefixer';

const markdownTransformer = path.join(__dirname, '../..', 'transformers', 'markdown');

const defaultConfig = {
  port: 8000,
  source: './posts',
  output: './_site',
  theme: './_theme',
  transformers: [],
  devServerConfig: {},
  postcssConfig: {
    plugins: [
      rucksack(),
      autoprefixer({
        browsers: ['last 2 versions', 'Firefox ESR', '> 1%', 'ie >= 8', 'iOS >= 8', 'Android >= 4'],
      }),
    ],
  },
  webpackConfig(config) {
    return config;
  },

  entryName: 'index',
  root: '/',
  filePathMapper(filePath) {
    return filePath;
  },
};

module.exports = function updateBishengConfig(customizedConfig) {
  const config = Object.assign({}, defaultConfig, customizedConfig);
  config.transformers = config.transformers.concat({
    test: /\.md$/,
    use: markdownTransformer,
  }).map(({ test, use }) => ({
    test: test.toString(), // Hack, for we cannot send RegExp to child process
    use,
  }));
  return config;
};
