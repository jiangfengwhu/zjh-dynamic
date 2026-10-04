import { PixelAlert as Alert } from "./PixelAlert";

import { currentAccountId, requireAccount } from "./account";

let asking = false;
export async function confirmCreation(action: string, appId: string, detail = "") {
  if (!await requireAccount()) throw new Error("请先登录后再创作");
  const owner = await currentAccountId();
  if (asking) throw new Error("请先处理当前确认");
  asking = true;
  try {
    const accepted = await new Promise<boolean>(resolve => Alert.alert(`确认${action}`, `应用：${appId}${detail ? `\n\n${detail.slice(0, 800)}` : ""}`, [{ text: "取消", style: "cancel", onPress: () => resolve(false) }, { text: action, style: /停止|删除|卸载|撤回/.test(action) ? "destructive" : "default", onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));
    if (!accepted) throw new Error("已取消操作");
    if (!owner || await currentAccountId() !== owner) throw new Error("账号已改变，请重新确认");
  } finally { asking = false; }
}
