'use strict';

const fs = require('fs');
const path = require('path');

// @expo/metro-config may be deduplicated to the top-level node_modules (Linux/EAS)
// or nested under expo/node_modules (Windows npm hoisting). Try both.
function resolveExpoTransformer() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', '@expo', 'metro-config', 'build', 'babel-transformer.js'),
    path.join(__dirname, '..', 'node_modules', 'expo', 'node_modules', '@expo', 'metro-config', 'build', 'babel-transformer.js'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    '[hermes-compat-transformer] Could not locate @expo/metro-config/build/babel-transformer.js.\n' +
    'Tried:\n' + candidates.map(p => '  ' + p).join('\n')
  );
}

const defaultTransformer = require(resolveExpoTransformer());

// Strip engine:'hermes' from customTransformOptions so babel-preset-expo selects
// the 'default' transform profile instead of 'hermes-stable'. This causes Babel
// to apply @babel/plugin-transform-classes and @babel/plugin-transform-private-*
// before hermesc sees the source, which is required because hermesc bundled with
// RN 0.81.x does not support native class declarations or #private fields.
const transform = (params) => {
  const { options } = params;
  return defaultTransformer.transform({
    ...params,
    options: {
      ...options,
      customTransformOptions: {
        ...(options.customTransformOptions || {}),
        engine: undefined,
      },
    },
  });
};

module.exports = { transform };
