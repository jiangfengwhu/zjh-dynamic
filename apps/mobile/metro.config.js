const fs = require('fs');
const path = require('path');

if (!process.env.ZIJINHUA_LAYER && process.argv.join(' ').includes('vendor-entry')) {
  process.env.ZIJINHUA_LAYER = 'vendor';
}
console.log('metro layer', process.env.ZIJINHUA_LAYER || 'dev');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { createModuleIdFactory, processModuleFilter } = require('./metro.ids.cjs');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const featuresDir = path.resolve(__dirname, '../../packages/features');
const componentsDir = path.resolve(__dirname, '../../packages/ui');
const config = {
  watchFolders: [featuresDir, componentsDir, path.resolve(__dirname, '../../packages/platform')],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    resolveRequest: (context, moduleName, platform) => {
      const resolved = context.resolveRequest(context, moduleName, platform);
      if (resolved.type !== 'sourceFile') return resolved;
      const normalized = resolved.filePath.replaceAll('\\', '/');
      if (!normalized.includes('/node_modules/zod/') || !resolved.filePath.endsWith('.js')) return resolved;
      const cjsPath = `${resolved.filePath.slice(0, -3)}.cjs`;
      if (!fs.existsSync(cjsPath)) return resolved;
      return { type: 'sourceFile', filePath: cjsPath };
    },
  },
  serializer: {
    createModuleIdFactory,
    processModuleFilter,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
