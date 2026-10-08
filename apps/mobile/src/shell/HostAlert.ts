import type { AlertButton, AlertOptions } from "react-native";

export type HostAlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
};
let sequence = 0;
const queue: HostAlertRequest[] = [];
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((listener) => listener());
}

/** Host-owned confirmations retain native Alert callback semantics. */
export const HostAlert = {
  alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) {
    queue.push({
      id: ++sequence,
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: "知道了" }],
      options,
    });
    notify();
  },
};
export function currentHostAlert() {
  return queue[0];
}
export function subscribeHostAlerts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function finishHostAlert(id: number, button?: AlertButton) {
  if (queue[0]?.id !== id) return;
  const request = queue.shift()!;
  notify();
  // Commit dismissal before navigation, storage or the next confirmation starts.
  requestAnimationFrame(() => {
    if (button) button.onPress?.();
    else request.options?.onDismiss?.();
  });
}
