import type { AppContext } from "./index";

export function applicationCapabilities(): Pick<AppContext, "clipboard" | "haptics" | "toast"> {
  return {
    clipboard: { get: () => require("@react-native-clipboard/clipboard").default.getString(), set: text => require("@react-native-clipboard/clipboard").default.setString(text) },
    haptics: { trigger: kind => require("react-native-haptic-feedback").default.trigger(kind, { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }) },
    toast: { show: (text, kind = "info") => require("react-native-toast-message").default.show({ type: kind, text1: text, position: "bottom" }) },
  };
}
