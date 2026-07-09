module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // Reanimated 4's worklets plugin MUST be the last plugin.
    plugins: [
      'react-native-worklets/plugin',
    ],
  };
};
