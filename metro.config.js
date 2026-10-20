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

/**
 * `obscenity` (utils/profanity) to its CommonJS build. Its package exports send
 * Metro to `index.mjs`, which is only `import mod from "./index.js"` — and the
 * CommonJS file marks itself `__esModule` without a default export, so under
 * Metro's interop `mod` is undefined and the bundle dies at startup reading
 * `mod.DataSet`. Node resolves the CommonJS file directly, which is what this
 * does too.
 */
const obscenityCjs = require.resolve('obscenity', { paths: [projectRoot] });
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'obscenity') return { type: 'sourceFile', filePath: obscenityCjs };
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/global.css' });
