import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bundleCdnBase, bundleEdgeBase } from './publish-bundle.js';
import { sha256Hex } from './release-set.js';

type BridgeSdk = { sha256: string; bytes: number };
type RuntimeContract = { format: number; runtimeVersion: string; dynamicRepository: string; bridgeSdk: BridgeSdk };

export async function fetchRuntimeContract(): Promise<RuntimeContract> {
  const response = await fetch(`${bundleEdgeBase()}/v1/runtime`);
  if (!response.ok) throw new Error(`读取 Android 运行时契约失败：${response.status}`);
  const contract = await response.json() as RuntimeContract;
  if (contract.format !== 1 || !/^[a-f0-9]{64}$/.test(contract.runtimeVersion) || contract.dynamicRepository !== 'jiangfengwhu/zjh-dynamic' || !/^[a-f0-9]{64}$/.test(contract.bridgeSdk?.sha256) || !Number.isSafeInteger(contract.bridgeSdk.bytes) || contract.bridgeSdk.bytes <= 0) {
    throw new Error('Android 运行时契约无效');
  }
  return contract;
}

export async function downloadBridgeSdk(root: string, sdk: BridgeSdk): Promise<void> {
  const directory = path.join(root, 'out/sdk');
  const filename = path.join(directory, 'bridge-sdk.jar');
  const valid = (bytes: Buffer) => bytes.length === sdk.bytes && sha256Hex(bytes) === sdk.sha256;
  try { if (valid(await readFile(filename))) return; } catch { /* 未下载 */ }
  const response = await fetch(`${bundleCdnBase()}/v1/sdk/${sdk.sha256}`);
  if (!response.ok) throw new Error(`下载桥接 SDK 失败：${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!valid(bytes)) throw new Error('桥接 SDK 校验失败');
  await mkdir(directory, { recursive: true });
  await writeFile(filename, bytes);
}
