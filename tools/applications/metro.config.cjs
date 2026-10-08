const fs = require('fs');
const path = require('path');
const mobile = process.env.ZIJINHUA_APPLICATION_REPO;
const root = process.env.ZIJINHUA_APPLICATION_ROOT;
const output = process.env.ZIJINHUA_APPLICATION_OUTPUT;
const appId = process.env.ZIJINHUA_APPLICATION_ID;
if (!root || !output || !appId) throw new Error('缺少独立应用构建配置');
const mobileRequire = require('module').createRequire(__filename);
const { getDefaultConfig, mergeConfig } = mobileRequire('@react-native/metro-config');
const allocation = { moduleRangeSize: 100000 };
const base = Number(process.env.ZIJINHUA_APPLICATION_BASE);
if (!Number.isSafeInteger(base)) throw new Error(`应用没有登记模块编号范围：${appId}`);
const shared = JSON.parse(fs.readFileSync(path.join(output, 'public-modules.json'), 'utf8'));
const sdkDependencies = new Set(Object.keys(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')).dependencies));
const seen = new Map();
const idsFile = path.join(output, 'module-ids.json');
let ids = {};
try { ids = JSON.parse(fs.readFileSync(idsFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
let next = base;
for (const id of Object.values(ids)) {
  if (!Number.isSafeInteger(id) || id < base || id >= base + allocation.moduleRangeSize) throw new Error('应用模块编号表无效');
  next = Math.max(next, id + 1);
}
const checkedPackages = new Set();
const within = (file, dir) => { const relative = path.relative(dir, file); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); };
module.exports = mergeConfig(getDefaultConfig(mobile), {
  projectRoot: mobile,
  watchFolders: [root, output],
  resolver: {
    nodeModulesPaths: [path.join(root, 'node_modules'), path.resolve(__dirname, '../node_modules'), path.join(mobile, 'node_modules')],
    resolveRequest(context, name, platform) {
      if (shared[name]) {
        return { type: 'sourceFile', filePath: path.join(output, 'external', `${Buffer.from(name).toString('hex')}.js`) };
      }
      if (name.startsWith('@zijinhua/') || Object.keys(shared).some(entry => name.startsWith(entry + '/'))) throw new Error(`未公开的共享模块入口：${name}`);
      const packageName = name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0];
      if (sdkDependencies.has(packageName)) throw new Error(`SDK 管理的依赖只能通过公开入口使用：${name}`);
      const result = context.resolveRequest(context, name, platform);
      if (result.type !== 'sourceFile') throw new Error(`首版应用暂不支持这个资源类型：${name}`);
      const normalized = result.filePath.replaceAll('\\', '/');
      if (within(result.filePath, output) || (within(result.filePath, root) && !normalized.includes('/node_modules/'))) return result;
      if (normalized.includes('/node_modules/')) {
        const packageRoot = normalized.match(/^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)\//)?.[1];
        if (packageRoot && !checkedPackages.has(packageRoot)) {
          checkedPackages.add(packageRoot);
          const json = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
          if (sdkDependencies.has(json.name)) throw new Error(`不能将 SDK 管理库的内部文件或别名打入应用：${json.name}`);
          if (json.codegenConfig || fs.existsSync(path.join(packageRoot, 'android')) || fs.existsSync(path.join(packageRoot, 'ios')) || fs.existsSync(path.join(packageRoot, 'react-native.config.js'))) throw new Error(`原生依赖必须由平台提供：${json.name}`);
        }
        return result;
      }
      throw new Error(`应用不能引用宿主或其他应用源码：${name}`);
    },
  },
  serializer: {
    createModuleIdFactory: () => file => {
      if (!seen.has(file)) {
        const normalized = file.replaceAll('\\', '/');
        const key = within(file, root) ? `app/${path.relative(root, file).replaceAll('\\', '/')}` : within(file, output) ? `build/${path.relative(output, file).replaceAll('\\', '/')}` : normalized.slice(normalized.lastIndexOf('/node_modules/') + 1);
        if (ids[key] == null) {
          if (next >= base + allocation.moduleRangeSize) throw new Error('应用模块编号范围已用尽');
          ids[key] = next++;
          fs.writeFileSync(idsFile, JSON.stringify(ids));
        }
        seen.set(file, ids[key]);
      }
      return seen.get(file);
    },
    processModuleFilter: module => module.path !== '__prelude__' && !(module.output?.[0]?.type?.startsWith('js/script') && !module.path.startsWith('require-')),
  },
});
