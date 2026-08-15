#!/usr/bin/env node
/**
 * Post-install patches for react-native 0.81 source files.
 *
 * Class syntax and #private-field transforms are now handled globally by the
 * windows-babel-transformer (metro.config.js) which forces the Babel 'default'
 * profile on Windows dev builds. The patches here fix RN 0.81 API gaps and
 * module-loading behaviour that apply on all platforms.
 */

const fs = require('fs');
const path = require('path');

const RN_SRC = path.join(__dirname, '..', 'node_modules', 'react-native', 'src');

if (!fs.existsSync(RN_SRC)) {
  console.log('[patch-rn] react-native src not found, skipping.');
  process.exit(0);
}

let patchedCount = 0;

// ---------------------------------------------------------------------------
// 1. Revert any eager DOMException injection in setUpDefaultReactNativeEnvironment.js
//    (polyfillGlobal in setUpDOM.js is sufficient).
// ---------------------------------------------------------------------------
const setUpEnvPath = path.join(RN_SRC, 'private', 'setup', 'setUpDefaultReactNativeEnvironment.js');
if (fs.existsSync(setUpEnvPath)) {
  let src = fs.readFileSync(setUpEnvPath, 'utf8');
  const injection = `global.DOMException = require('../webapis/errors/DOMException').default;\n`;
  const commentBlock = `// Register DOMException as a global eagerly so any module in the init chain\n// that references it as a bare global (e.g. third-party libs) can find it.\n// React Native 0.81 omits this from polyfillGlobal; browsers have it natively.\n// $FlowExpectedError[cannot-write]\n`;
  if (src.includes(injection)) {
    src = src.replace(commentBlock + injection + '\n', '');
    src = src.replace(injection, '');
    fs.writeFileSync(setUpEnvPath, src, 'utf8');
    console.log('[patch-rn] Reverted: setUpDefaultReactNativeEnvironment.js (removed eager DOMException injection)');
    patchedCount++;
  }
}

// ---------------------------------------------------------------------------
// 2. Register DOMException and PerformanceEntry via polyfillGlobal in setUpDOM.js.
//
//    React Native 0.81 does not expose these as global identifiers. Third-party
//    modules (and some internal modules loaded during setUpPerformance) access
//    them as bare globals, producing "Property 'X' doesn't exist" errors.
//    polyfillGlobal installs a lazy getter so they resolve once setUpDOM() runs.
// ---------------------------------------------------------------------------
const setUpDOMPath = path.join(RN_SRC, 'private', 'setup', 'setUpDOM.js');
if (fs.existsSync(setUpDOMPath)) {
  let setUpDOM = fs.readFileSync(setUpDOMPath, 'utf8');

  const domExceptionEntry = `  polyfillGlobal(\n    'DOMException',\n    () => require('../webapis/errors/DOMException').default,\n  );`;
  const perfEntryPolyfill = `  polyfillGlobal(\n    'PerformanceEntry',\n    () => require('../webapis/performance/PerformanceEntry').PerformanceEntry,\n  );`;

  let changed = false;

  if (!setUpDOM.includes(domExceptionEntry)) {
    setUpDOM = setUpDOM.replace(
      `  polyfillGlobal(\n    'HTMLElement',\n    () => require('../webapis/dom/nodes/ReactNativeElement').default,\n  );\n}`,
      `  polyfillGlobal(\n    'HTMLElement',\n    () => require('../webapis/dom/nodes/ReactNativeElement').default,\n  );\n\n${domExceptionEntry}\n}`,
    );
    changed = true;
    console.log('[patch-rn] Patched: setUpDOM.js (added DOMException polyfillGlobal)');
  }

  if (!setUpDOM.includes(perfEntryPolyfill)) {
    setUpDOM = setUpDOM.replace(
      domExceptionEntry + '\n}',
      domExceptionEntry + '\n\n' + perfEntryPolyfill + '\n}',
    );
    changed = true;
    console.log('[patch-rn] Patched: setUpDOM.js (added PerformanceEntry polyfillGlobal)');
  }

  if (changed) {
    fs.writeFileSync(setUpDOMPath, setUpDOM, 'utf8');
    patchedCount++;
  }
}

// ---------------------------------------------------------------------------
// 3. Make TurboModuleRegistry lazy-load NativeModules.
//
//    The original top-level eager require of NativeModules pulls in
//    BatchedBridge → MessageQueue at startup. In new arch / bridgeless mode
//    NativeModules is never actually used, so the eager load is wasteful.
//    Moving the require inside the legacy-mode guard avoids loading the
//    entire BatchedBridge chain when it isn't needed.
// ---------------------------------------------------------------------------
const turboModuleRegistryPath = path.join(
  __dirname, '..', 'node_modules', 'react-native',
  'Libraries', 'TurboModule', 'TurboModuleRegistry.js',
);
if (fs.existsSync(turboModuleRegistryPath)) {
  const TURBO_SENTINEL = '// PATCHED: lazy NativeModules require';
  let tmr = fs.readFileSync(turboModuleRegistryPath, 'utf8');
  if (!tmr.includes(TURBO_SENTINEL)) {
    tmr = tmr.replace(
      `const NativeModules = require('../BatchedBridge/NativeModules').default;`,
      `${TURBO_SENTINEL}\nlet _NativeModules = null;\nfunction getNativeModules() {\n  if (_NativeModules == null) {\n    _NativeModules = require('../BatchedBridge/NativeModules').default;\n  }\n  return _NativeModules;\n}`,
    );
    tmr = tmr.replace(
      `const legacyModule: ?T = NativeModules[name];`,
      `const legacyModule: ?T = (getNativeModules()[name]: any);`,
    );
    if (tmr.includes(TURBO_SENTINEL)) {
      fs.writeFileSync(turboModuleRegistryPath, tmr, 'utf8');
      patchedCount++;
      console.log('[patch-rn] Patched: TurboModuleRegistry.js (lazy NativeModules)');
    } else {
      console.warn('[patch-rn] WARNING: could not patch TurboModuleRegistry.js');
    }
  }
}

console.log(`\n[patch-rn] Done. Patched ${patchedCount} file(s).`);
