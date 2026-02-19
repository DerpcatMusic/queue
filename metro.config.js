const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle .pmtiles files as binary assets
config.resolver.assetExts.push("pmtiles");

module.exports = config;
