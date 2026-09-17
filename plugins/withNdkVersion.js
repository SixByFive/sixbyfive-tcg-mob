const { withAppBuildGradle } = require('@expo/config-plugins');

// Sets android.ndkVersion in the generated app/build.gradle.
// NDK 27+ is required for 16 KB page size support (Google Play requirement for Android 15+).
module.exports = function withNdkVersion(config, { ndkVersion = '28.0.12433566' } = {}) {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /ndkVersion\s+rootProject\.ext\.ndkVersion/,
      `ndkVersion "${ndkVersion}"`
    );
    return config;
  });
};
