import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
const root=process.cwd();
const sdk=path.join(root,'packages/app-sdk');
const out=path.join(sdk,'dist');
const manifest=JSON.parse(await fs.readFile(path.join(sdk,'package.json'),'utf8'));
const platform=JSON.parse(await fs.readFile(path.join(sdk,'platform.json'),'utf8'));
for (const [entry,version] of Object.entries(platform.shared)) {
 const name=entry.startsWith('@')?entry.split('/').slice(0,2).join('/'):entry.split('/')[0];
 if(manifest.dependencies[name]!==version && !(platform.dependencyArtifacts?.[name]?.version===version && manifest.dependencies[name]===platform.dependencyArtifacts[name].url))throw new Error(`SDK 共享依赖与运行时契约不一致：${name}`);
}
await fs.mkdir(out,{recursive:true});
await fs.rm(path.join(out,"repository-migration.json"),{force:true});
for(const [entry,name] of [['index','index'],['creation','creation'],['host-ui','ui']]) {
 const bundle=await rollup({input:path.join(sdk,`src/${entry}.ts`),plugins:[dts({tsconfig:path.join(root,'apps/mobile/tsconfig.json')})],external:id=>!id.startsWith('.')&&!path.isAbsolute(id)});
 await bundle.write({file:path.join(out,`${name}.d.ts`),format:'es'});await bundle.close();
 const declarations=path.join(out,`${name}.d.ts`);await fs.writeFile(declarations,(await fs.readFile(declarations,'utf8')).replaceAll("from '@types/react'","from 'react'"));
}
for(const name of ['index','creation']) await build({entryPoints:[path.join(sdk,`src/${name}.ts`)],outfile:path.join(out,`${name}.js`),bundle:true,platform:'node',format:'cjs',packages:'external'});
await fs.writeFile(path.join(out,'ui.js'),'module.exports = globalThis.__zijinhuaApplications.require("@zijinhua/app-sdk/ui", "");\n');
await build({entryPoints:['tools/applications/cli.ts'],outfile:path.join(out,'cli.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',banner:{js:'#!/usr/bin/env node'}});
for(const [from,to] of [['tools/applications/metro.config.cjs','metro.config.cjs'],['packages/app-sdk/platform.json','platform.json']])await fs.copyFile(from,path.join(out,to));
await fs.writeFile(path.join(out,'babel.cjs'),`module.exports={presets:[require.resolve('@react-native/babel-preset')],plugins:[require.resolve('react-native-worklets/plugin')]};\n`);
console.log('SDK built: packages/app-sdk/dist');
