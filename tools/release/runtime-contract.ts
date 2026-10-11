import { bundleEdgeBase } from './publish-bundle.js';

type RuntimeContract = { apk: { versionCode: number; versionName: string }; format: number; runtimeVersion: string; dynamicRepository: string; applications?: { engineAbi: string; sdk: string; shared: Record<string, string> } };

export async function fetchRuntimeContract(): Promise<RuntimeContract> {
  const response = await fetch(`${bundleEdgeBase()}/v1/runtime`);
  if (!response.ok) throw new Error(`读取 Android 运行时契约失败：${response.status}`);
  const contract = await response.json() as RuntimeContract;
  if (!Number.isSafeInteger(contract.apk?.versionCode) || contract.apk.versionCode < 1 || !contract.apk.versionName || contract.format !== 1 || !/^[a-f0-9]{64}$/.test(contract.runtimeVersion) || contract.dynamicRepository !== 'jiangfengwhu/zjh-dynamic') {
    throw new Error('Android 运行时契约无效');
  }
  return contract;
}
