// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'worker/*'] },
  {
    // react-three-fiber elements (<mesh>, <ambientLight>, ...) take three.js properties, not DOM ones.
    files: ['src/components/Viewer3D.tsx'],
    rules: { 'react/no-unknown-property': 'off' },
  },
]);
