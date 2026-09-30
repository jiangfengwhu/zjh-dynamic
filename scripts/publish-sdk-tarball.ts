import { readFile } from 'node:fs/promises';
import { publishBundleObjects, bundleCdnBase } from '../tools/release/publish-bundle.js';
import { sha256Hex } from '../tools/release/release-set.js';
const file='dist/zijinhua-app-sdk-1.0.0.tgz';
const key=`v1/sdk/${sha256Hex(await readFile(file))}`;
await publishBundleObjects([{key,file,contentType:'application/gzip',cacheControl:'public,max-age=31536000,immutable'}]);
console.log(`SDK_URL=${bundleCdnBase()}/${key}`);
