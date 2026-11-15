const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

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
