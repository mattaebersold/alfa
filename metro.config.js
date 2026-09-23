const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/**
 * @ors/kit is a git submodule at ./kit, linked in by `file:./kit` — inside the
 * project so EAS uploads it with the app (a sibling folder never left the Mac).
 *
 * Metro only bundles files inside the project unless told otherwise, so the kit
 * is added as a watch folder. Its source has no node_modules of its own — every
 * dependency it imports is a peer this app installs — so modules are resolved
 * from this app's node_modules first. That is also what keeps a single copy of
 * react and react-native in the bundle. (Same arrangement as photo and spot.)
 */
const projectRoot = __dirname;
const kitRoot = path.resolve(projectRoot, 'kit');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [...(config.watchFolders ?? []), kitRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = withNativeWind(config, { input: './src/global.css' });
