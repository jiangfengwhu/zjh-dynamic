import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Preserve the renderer's 7.0.2 API and source; replace its vulnerable parser dependency.
const upstream = 'https://registry.npmjs.org/react-native-markdown-display/-/react-native-markdown-display-7.0.2.tgz';
const integrity = 'Mn4wotMvMfLAwbX/huMLt202W5DsdpMO/kblk+6eUs55S57VVNni1gzZCh5qpznYLjIQELNh50VIozEfY6fvaQ==';
const out = path.resolve('dist');
await fs.mkdir(out, { recursive: true });
const directory = await fs.mkdtemp(path.join(out, 'markdown-display-'));
const response = await fetch(upstream);
if (!response.ok) throw new Error(`Markdown upstream download failed: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
if (createHash('sha512').update(bytes).digest('base64') !== integrity) throw new Error('Markdown upstream integrity mismatch');
const archive = path.join(directory, 'upstream.tgz');
await fs.writeFile(archive, bytes);
execFileSync('tar', ['-xzf', archive, '-C', directory], { windowsHide: true });
const file = path.join(directory, 'package/package.json');
const pkg = JSON.parse(await fs.readFile(file, 'utf8'));
if (pkg.name !== 'react-native-markdown-display' || pkg.version !== '7.0.2') throw new Error('Unexpected Markdown renderer');
pkg.dependencies['markdown-it'] = '15.0.2';
pkg.zjhSecurityPatch = { upstream, integrity: `sha512-${integrity}`, markdownIt: '15.0.2' };
await fs.writeFile(file, JSON.stringify(pkg, null, 2) + '\n');
if (!process.env.npm_execpath) throw new Error('Run npm run build:markdown');
execFileSync(process.execPath, [process.env.npm_execpath, 'pack', path.dirname(file), '--pack-destination', out], { windowsHide: true, stdio: 'inherit' });
const tarball = path.join(out, 'react-native-markdown-display-7.0.2.tgz');
const hash = createHash('sha256').update(await fs.readFile(tarball)).digest('hex');
console.log(`MARKDOWN_URL=https://zjh-cdn.297782.xyz/v1/sdk/${hash}`);
