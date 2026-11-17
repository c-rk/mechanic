// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// three's CommonJS entry (build/three.cjs) calls process.emitWarning, which React Native does not
// provide, so `require('three')` (used by @react-three/fiber/native) crashes at startup.
// Always resolve the ES module build, which is also what the web build uses: one copy of three.
const threeModule = path.resolve(__dirname, 'node_modules/three/build/three.module.js');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: threeModule };
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
