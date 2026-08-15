'use strict';
// Windows Hermes hermesc.exe miscompiles class declarations inside module
// factory functions under the hermes-stable transform profile (no Babel class
// transform). Fix: strip the 'engine' caller hint so babel-preset-expo falls
// back to the 'default' profile, which applies @babel/plugin-transform-classes
// before hermesc sees the source. EAS (Linux) builds are unaffected.
//
// Loaded via metro.config.js: config.transformer.babelTransformerPath on Windows.

const path = require('path');

// Require the default Expo Metro Babel transformer.
// This lives inside expo's own node_modules since it's an internal package.
const defaultTransformer = require(
  path.join(__dirname, '..', 'node_modules', 'expo', 'node_modules', '@expo', 'metro-config', 'build', 'babel-transformer.js')
);

const transform = (params) => {
  const {options} = params;
  return defaultTransformer.transform({
    ...params,
    options: {
      ...options,
      customTransformOptions: {
        ...(options.customTransformOptions || {}),
        // Suppress 'hermes' so babel-preset-expo picks 'default' profile.
        // See: babel-preset-expo/build/index.js line ~55
        engine: undefined,
      },
    },
  });
};

module.exports = {transform};
