import { sdkCompatibility } from "../../../../packages/app-sdk/src/compatibility";

export class ApplicationSdkError extends Error {
  constructor(readonly action: "update-application" | "update-platform", required: string, available: string) {
    super(action === "update-application"
      ? `这个应用尚未适配当前生花。应用 SDK ${required}，当前 SDK ${available}。请到应用市场的「我安装的」更新应用；若暂无新版，需要作者更新并重新发布。本机数据会保留。`
      : `当前生花版本无法运行这个应用。应用需要 SDK ${required}，当前 SDK ${available}。请先检查更新并升级生花；若暂无更新，请等待新版发布。`);
    this.name = "ApplicationSdkError";
  }
}

export function assertApplicationSdkCompatible(required: string, available: string) {
  const status = sdkCompatibility(required, available);
  if (status === "compatible") return;
  if (status === "invalid") throw new Error("应用 SDK 版本信息无效，请联系作者重新发布");
  throw new ApplicationSdkError(status, required, available);
}
