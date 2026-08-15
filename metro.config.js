const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// hermesc (Windows and Linux, RN 0.81.x) does not support native class syntax
// or private fields (#field) when produced by the hermes-stable Babel profile.
// Strip the 'engine: hermes' caller hint so babel-preset-expo falls back to the
// 'default' profile and applies full class/private-field transforms before
// hermesc sees the bundle.
config.transformer.babelTransformerPath = path.resolve(
  __dirname,
  "scripts",
  "windows-babel-transformer.js"
);

module.exports = config;
