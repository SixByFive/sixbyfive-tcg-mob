module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // no plugins needed for expo-router in SDK 50+
    plugins: ["react-native-reanimated/plugin"],
  };
};
