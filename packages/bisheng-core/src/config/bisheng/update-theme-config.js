const path = require('path');

function isRelative(filepath) {
  return filepath.charAt(0) === '.';
}

function toAbsolutePath(plugin) {
  return isRelative(plugin) ? path.join(process.cwd(), plugin) : plugin;
}

module.exports = function updateThemeConfig(customizedConfig) {
  customizedConfig.plugins = customizedConfig.plugins.map(toAbsolutePath);
  return customizedConfig;
};
