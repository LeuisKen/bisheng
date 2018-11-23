import openBrowser from 'react-dev-utils/openBrowser';
import getWebpackCommonConfig from './config/webpack/getWebpackCommonConfig';
import updateWebpackConfig from './config/webpack/updateWebpackConfig';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const nunjucks = require('nunjucks');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const R = require('ramda');
const ghPages = require('gh-pages');
const updateBishengConfig = require('./config/bisheng/update-bisheng-config');
const sourceData = require('./utils/source-data');
const generateFilesPath = require('./utils/generate-files-path');
const updateThemeConfig = require('./config/bisheng/update-theme-config');
const context = require('./context');
const Module = require('module');

// We need to inject the require logic to support use origin node_modules
// if currently not provided.
const oriRequire = Module.prototype.require;
Module.prototype.require = function (...args) {
  const moduleName = args[0];
  try {
    return oriRequire.apply(this, args);
  } catch (err) {
    const newArgs = [...args];
    if (moduleName[0] !== '/') {
      newArgs[0] = path.join(process.cwd(), 'node_modules', moduleName);
    }
    return oriRequire.apply(this, newArgs);
  }
};

function getRoutesPath(themePath, configEntryName) {
  const { bishengConfig, themeConfig, routesTemplate, tmpDirPath } = context;
  const routesPath = path.join(tmpDirPath, `routes.${configEntryName}.js`);
  fs.writeFileSync(
    routesPath,
    nunjucks.renderString(routesTemplate, {
      themePath: escapeWinPath(themePath),
      themeConfig: JSON.stringify(bishengConfig.themeConfig),
      themeRoutes: JSON.stringify(themeConfig.routes),
    }),
  );
  return routesPath;
}

function generateEntryFile(configTheme, configEntryName, root) {
  const { entryTemplate, tmpDirPath } = context;
  const entryPath = path.join(tmpDirPath, `entry.${configEntryName}.js`);
  const routesPath = getRoutesPath(
    path.dirname(configTheme),
    configEntryName,
  );
  fs.writeFileSync(
    entryPath,
    nunjucks.renderString(entryTemplate, {
      routesPath: escapeWinPath(routesPath),
      root: escapeWinPath(root),
    }),
  );
}

exports.dev = function dev(customizedContext) {
  const bishengConfig = updateBishengConfig(customizedContext.bishengConfig);
  const themeConfig = updateThemeConfig(customizedContext.themeConfig);
  const tmpDirPath = path.join(path.dirname(customizedContext.entryTemplate), '..', 'tmp');

  context.initialize({
    entryTemplate: fs.readFileSync(customizedContext.entryTemplate).toString(),
    routesTemplate: fs.readFileSync(customizedContext.routesTemplate).toString(),
    tmpDirPath,
    bishengConfig,
    themeConfig,
    themeRoutes: customizedContext.themeRoutes
  });

  mkdirp.sync(tmpDirPath);
  mkdirp.sync(bishengConfig.output);

  const template = fs.readFileSync(bishengConfig.htmlTemplate).toString();
  const templateData = Object.assign(
    { root: '/' },
    bishengConfig.htmlTemplateExtraData || {},
  );
  const templatePath = path.join(
    process.cwd(),
    bishengConfig.output,
    'index.html',
  );
  fs.writeFileSync(templatePath, nunjucks.renderString(template, templateData));

  generateEntryFile(
    bishengConfig.theme,
    bishengConfig.entryName,
    '/',
  );

  const webpackConfig = updateWebpackConfig(getWebpackCommonConfig(), 'dev');
  webpackConfig.plugins.push(new webpack.HotModuleReplacementPlugin());
  const serverOptions = {
    quiet: true,
    hot: true,
    ...bishengConfig.devServerConfig,
    contentBase: path.join(process.cwd(), bishengConfig.output),
    historyApiFallback: true,
    host: 'localhost',
  };
  WebpackDevServer.addDevServerEntrypoints(webpackConfig, serverOptions);
  const compiler = webpack(webpackConfig);

  // Ref: https://github.com/pigcan/blog/issues/6
  // Webpack startup recompilation fix. Remove when @sokra fixes the bug.
  // https://github.com/webpack/webpack/issues/2983
  // https://github.com/webpack/watchpack/issues/25
  const timefix = 11000;
  compiler.plugin('watch-run', (watching, callback) => {
    watching.startTime += timefix;
    callback();
  });
  compiler.plugin('done', (stats) => {
    stats.startTime -= timefix;
  });

  const server = new WebpackDevServer(compiler, serverOptions);
  server.listen(bishengConfig.port, '0.0.0.0', () => openBrowser(`http://localhost:${bishengConfig.port}`));
};


function filenameToUrl(filename) {
  if (filename.endsWith('index.html')) {
    return filename.replace(/index\.html$/, '');
  }
  return filename.replace(/\.html$/, '');
}

exports.build = function build(customizedContext, callback) {
  const bishengConfig = updateBishengConfig(customizedContext.bishengConfig);
  const themeConfig = updateThemeConfig(customizedContext.themeConfig);
  const tmpDirPath = path.join(path.dirname(customizedContext.entryTemplate), '..', 'tmp');

  context.initialize({
    entryTemplate: fs.readFileSync(customizedContext.entryTemplate).toString(),
    ssrTemplate: fs.readFileSync(customizedContext.ssrTemplate).toString(),
    routesTemplate: fs.readFileSync(customizedContext.routesTemplate).toString(),
    tmpDirPath,
    bishengConfig,
    themeConfig,
    themeRoutes: customizedContext.themeRoutes,
    isBuild: true,
  });

  mkdirp.sync(tmpDirPath);
  mkdirp.sync(bishengConfig.output);

  const { entryName } = bishengConfig;
  generateEntryFile(
    bishengConfig.theme,
    entryName,
    bishengConfig.root,
  );
  const webpackConfig = updateWebpackConfig(getWebpackCommonConfig(), 'build');
  webpackConfig.plugins.push(
    new webpack.LoaderOptionsPlugin({
      minimize: true,
    }),
  );

  webpackConfig.plugins.push(
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV || 'production',
      ),
    }),
  );

  const ssrWebpackConfig = Object.assign({}, webpackConfig);
  const ssrPath = path.join(tmpDirPath, `ssr.${entryName}.js`);
  const routesPath = getRoutesPath(path.dirname(bishengConfig.theme), entryName);

  fs.writeFileSync(ssrPath, nunjucks.renderString(context.ssrTemplate, { routesPath: escapeWinPath(routesPath) }));

  ssrWebpackConfig.entry = {
    [`${entryName}-ssr`]: ssrPath,
  };
  ssrWebpackConfig.target = 'node';
  ssrWebpackConfig.output = Object.assign({}, ssrWebpackConfig.output, {
    path: tmpDirPath,
    library: 'ssr',
    libraryTarget: 'commonjs',
  });

  webpack(webpackConfig, (err, stats) => {
    if (err !== null) {
      return console.error(err);
    }

    if (stats.hasErrors()) {
      console.log(stats.toString('errors-only'));
      return;
    }

    const markdown = sourceData.generate(bishengConfig.source, bishengConfig.transformers);
    let filesNeedCreated = generateFilesPath(themeConfig.routes, markdown).map(bishengConfig.filePathMapper);
    filesNeedCreated = R.unnest(filesNeedCreated);

    const template = fs.readFileSync(bishengConfig.htmlTemplate).toString();

    if (!customizedContext.ssr) {
      require('./loaders/common/boss').jobDone();
      const templateData = Object.assign(
        { root: bishengConfig.root },
        bishengConfig.htmlTemplateExtraData || {},
      );
      const fileContent = nunjucks.renderString(template, templateData);
      filesNeedCreated.forEach((file) => {
        const output = path.join(bishengConfig.output, file);
        mkdirp.sync(path.dirname(output));
        fs.writeFileSync(output, fileContent);
        console.log('Created: ', output);
      });

      if (callback) {
        callback();
      }
      return;
    }

    context.turnOnSSRFlag();
    // If we can build webpackConfig without errors, we can build ssrWebpackConfig without errors.
    // Because ssrWebpackConfig are just part of webpackConfig.
    webpack(ssrWebpackConfig, (ssrBuildErr, ssrBuildStats) => {
      if (ssrBuildErr) throw ssrBuildErr;
      if (ssrBuildStats.hasErrors()) throw ssrBuildStats.toString('errors-only');

      require('./loaders/common/boss').jobDone();

      const { ssr } = require(path.join(tmpDirPath, `${entryName}-ssr`));
      const fileCreatedPromises = filesNeedCreated.map((file) => {
        const output = path.join(bishengConfig.output, file);
        mkdirp.sync(path.dirname(output));
        return new Promise((resolve) => {
          ssr(filenameToUrl(file), (error, content) => {
            if (error) {
              console.error(error);
              process.exit(1);
            }
            const templateData = Object.assign(
              { root: bishengConfig.root, content },
              bishengConfig.htmlTemplateExtraData || {},
            );
            const fileContent = nunjucks.renderString(template, templateData);
            fs.writeFileSync(output, fileContent);
            console.log('Created: ', output);
            resolve();
          });
        });
      });
      Promise.all(fileCreatedPromises).then(() => {
        if (callback) {
          callback();
        }
      });
    });
  });
};
