const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

const escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizePathForRegex = (value) => value.replace(/[\\/]+/g, "[/\\\\]");

const blockDirs = [
  ".gradle-user-home",
  path.join("android", ".gradle"),
  path.join("android", "build"),
  path.join("ios", "build"),
];

const blockListPatterns = blockDirs.map((dir) => {
  const escaped = escapeForRegex(normalizePathForRegex(path.resolve(__dirname, dir)));
  return new RegExp(`^${escaped}([/\\\\].*)?$`);
});

config.resolver.blockList = blockListPatterns;

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = withNativeWind(config, { input: "./global.css" });
