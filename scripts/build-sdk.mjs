import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
const root=process.cwd();
const sdk=path.join(root,'packages/app-sdk');
const out=path.join(sdk,'dist');
await fs.mkdir(out,{recursive:true});
for(const [entry,name] of [['index','index'],['creation','creation'],['host-ui','ui']]) {
 const bundle=await rollup({input:path.join(sdk,`src/${entry}.ts`),plugins:[dts({tsconfig:path.join(root,'apps/mobile/tsconfig.json')})],external:id=>!id.startsWith('.')&&!path.isAbsolute(id)});
 await bundle.write({file:path.join(out,`${name}.d.ts`),format:'es'});await bundle.close();
 const declarations=path.join(out,`${name}.d.ts`);await fs.writeFile(declarations,(await fs.readFile(declarations,'utf8')).replaceAll("from '@types/react'","from 'react'"));
}
for(const name of ['index','creation']) await build({entryPoints:[path.join(sdk,`src/${name}.ts`)],outfile:path.join(out,`${name}.js`),bundle:true,platform:'node',format:'cjs',packages:'external'});
await fs.writeFile(path.join(out,'ui.js'),'module.exports = globalThis.__zijinhuaApplications.require("@zijinhua/app-sdk/ui", "");\n');
await build({entryPoints:['tools/applications/cli.ts'],outfile:path.join(out,'cli.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',banner:{js:'#!/usr/bin/env node'}});
for(const [from,to] of [['tools/applications/metro.config.cjs','metro.config.cjs'],['packages/app-sdk/platform.json','platform.json'],['tools/applications/repository-migration.json','repository-migration.json']])await fs.copyFile(from,path.join(out,to));
await fs.writeFile(path.join(out,'babel.cjs'),`module.exports={presets:[require.resolve('@react-native/babel-preset')],plugins:[require.resolve('react-native-worklets/plugin')]};\n`);
console.log('SDK built: packages/app-sdk/dist');
