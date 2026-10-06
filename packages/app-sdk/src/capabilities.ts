import type { AppContext } from "./index";
import { notify } from "../../ui/feedback/Toasts";

export function applicationCapabilities(): Pick<AppContext, "clipboard" | "haptics" | "toast"> {
  return {
    clipboard: { get: () => require("@react-native-clipboard/clipboard").default.getString(), set: text => require("@react-native-clipboard/clipboard").default.setString(text) },
    haptics: { trigger: kind => require("react-native-haptic-feedback").default.trigger(kind, { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }) },
    toast: { show: (text, kind = "info") => notify.show({ type: kind, text1: text }) },
  };
}
