const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// On Windows, the Hermes bytecode compiler (hermesc.exe) miscompiles class
// declarations inside module factory functions when the hermes-stable transform
// profile is active (native class syntax is not Babel-transformed). Use a
// custom transformer that strips the 'engine' caller hint so babel-preset-expo
// falls back to the 'default' profile and applies Babel class transforms before
// hermesc sees the source. EAS builds (Linux) are unaffected.
if (process.platform === "win32") {
  config.transformer.babelTransformerPath = path.resolve(
    __dirname,
    "scripts",
    "windows-babel-transformer.js"
  );
}

module.exports = config;
