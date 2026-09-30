import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleRelease } from '../tools/release/bundle-js.ts';

await bundleRelease(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), '本地预览', { publish: false });
