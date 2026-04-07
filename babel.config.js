module.exports = (api) => {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      ["react-native-unistyles/plugin", { root: "src" }], // FIRST - unistyles
      "react-native-reanimated/plugin", // SECOND - reanimated (includes worklets)
    ],
  };
};
