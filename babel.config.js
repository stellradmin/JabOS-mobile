module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      // NativeWind provides a preset-like export; keep it here
      "nativewind/babel",
    ],
    plugins: [
      // React Native Reanimated v4 moved its Babel plugin here (keep last)
      "react-native-worklets/plugin",
    ],
  };
};
