const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const reactNavigationPackages = [
  "@react-navigation/bottom-tabs",
  "@react-navigation/core",
  "@react-navigation/elements",
  "@react-navigation/native",
  "@react-navigation/native-stack",
];

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

const nodeModulesAndroidBuildPatterns = [
  new RegExp(
    `^${escapeForRegex(normalizePathForRegex(path.resolve(__dirname, "node_modules")))}[/\\\\][^/\\\\]+[/\\\\]android[/\\\\]build([/\\\\].*)?$`,
  ),
  new RegExp(
    `^${escapeForRegex(normalizePathForRegex(path.resolve(__dirname, "node_modules")))}[/\\\\]@[^/\\\\]+[/\\\\][^/\\\\]+[/\\\\]android[/\\\\]build([/\\\\].*)?$`,
  ),
  new RegExp(
    `^${escapeForRegex(normalizePathForRegex(path.resolve(__dirname, "node_modules")))}[/\\\\][^/\\\\]+[/\\\\]android[/\\\\]\\.cxx([/\\\\].*)?$`,
  ),
  new RegExp(
    `^${escapeForRegex(normalizePathForRegex(path.resolve(__dirname, "node_modules")))}[/\\\\]@[^/\\\\]+[/\\\\][^/\\\\]+[/\\\\]android[/\\\\]\\.cxx([/\\\\].*)?$`,
  ),
];

config.resolver.blockList = [...blockListPatterns, ...nodeModulesAndroidBuildPatterns];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  ...Object.fromEntries(
    reactNavigationPackages.map((pkg) => [
      pkg,
      path.dirname(require.resolve(`${pkg}/package.json`)),
    ]),
  ),
};

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
