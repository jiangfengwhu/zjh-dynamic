import { bindApplicationSdk, registerApplication, setApplicationCreationNavigation } from "../../../../packages/app-sdk/src/runtime";
import * as ui from "../../../../packages/app-sdk/src/host-ui";
import { creationService } from "../shell/cloudEvolve";
import { checkApplicationUpdates, applyApplicationUpdate } from "./applications";
import { loadSharing } from "../shell/market";
import { currentAccountId } from "../shell/account";
import { shellNavigationRef } from "../shell/navigation";
import { readShellValue, writeShellValue } from "../shell/shellStorage";
import { openCreationRequest } from "../shell/workshopNavigation";

const modules: Record<string, () => unknown> = {
  "@d11/react-native-fast-image": () => require("@d11/react-native-fast-image"),
  "@gorhom/bottom-sheet": () => require("@gorhom/bottom-sheet"),
  "@react-native-clipboard/clipboard": () => require("@react-native-clipboard/clipboard"),
  "@react-native-community/blur": () => require("@react-native-community/blur"),
  "@react-native-community/datetimepicker": () => require("@react-native-community/datetimepicker"),
  "@react-native-community/netinfo": () => require("@react-native-community/netinfo"),
  "@react-native-community/slider": () => require("@react-native-community/slider"),
  "@react-native-documents/picker": () => require("@react-native-documents/picker"),
  "@react-native-picker/picker": () => require("@react-native-picker/picker"),
  "@react-navigation/material-top-tabs": () => require("@react-navigation/material-top-tabs"),
  "@react-navigation/native": () => require("@react-navigation/native"),
  "@react-navigation/native-stack": () => require("@react-navigation/native-stack"),
  "@shopify/flash-list": () => require("@shopify/flash-list"),
  "@shopify/react-native-skia": () => require("@shopify/react-native-skia"),
  "date-fns": () => require("date-fns"),
  "lottie-react-native": () => require("lottie-react-native"),
  "lucide-react-native": () => require("lucide-react-native"),
  "react": () => require("react"),
  "react-error-boundary": () => require("react-error-boundary"),
  "react-native": () => require("react-native"),
  "react-native-calendars": () => require("react-native-calendars"),
  "react-native-gesture-handler": () => require("react-native-gesture-handler"),
  "react-native-gifted-charts": () => require("react-native-gifted-charts"),
  "react-native-haptic-feedback": () => require("react-native-haptic-feedback"),
  "react-native-image-crop-picker": () => require("react-native-image-crop-picker"),
  "react-native-keyboard-controller": () => require("react-native-keyboard-controller"),
  "react-native-linear-gradient": () => require("react-native-linear-gradient"),
  "react-native-markdown-display": () => require("react-native-markdown-display"),
  "react-native-nitro-image": () => require("react-native-nitro-image"),
  "react-native-pager-view": () => require("react-native-pager-view"),
  "react-native-pdf": () => require("react-native-pdf"),
  "react-native-qrcode-svg": () => require("react-native-qrcode-svg"),
  "react-native-reanimated": () => require("react-native-reanimated"),
  "react-native-safe-area-context": () => require("react-native-safe-area-context"),
  "react-native-svg": () => require("react-native-svg"),
  "react-native-video": () => require("react-native-video"),
  "react-native-view-shot": () => require("react-native-view-shot"),
  "react-native-vision-camera": () => require("react-native-vision-camera"),
  "react-native-webview": () => require("react-native-webview"),
  "react-native-worklets": () => require("react-native-worklets"),
  "zod": () => require("zod"),
  "react/jsx-runtime": () => require("react/jsx-runtime"),
  "react/jsx-dev-runtime": () => require("react/jsx-dev-runtime"),
  "@zijinhua/app-sdk/ui": () => ui,
};

export function installApplicationPlatform() {
  const target = globalThis as typeof globalThis & { __zijinhuaApplications?: unknown };
  if (target.__zijinhuaApplications) return;
  setApplicationCreationNavigation((appId, prompt) => { void openCreationRequest(appId, prompt).catch(() => {}); });
  target.__zijinhuaApplications = Object.freeze({
    require: (name: string, appId: string) => {
      if (name === "@zijinhua/app-sdk") return bindApplicationSdk(appId);
      if (name === "@zijinhua/app-sdk/creation") {
        // Engineering API selection only: shared JS has no trustworthy caller appId.
        // Server ownership and per-round authorization protect creation operations.
        if (appId !== "jolly") throw new Error("当前应用未获得制作能力");
        return { getCreationService: (targetAppId: string, originalAppId?: string) => ({ ...creationService(targetAppId, originalAppId), checkPackageUpdates: async () => (await checkApplicationUpdates(targetAppId)).filter(item => item.id === targetAppId),
          applyPackageUpdates: () => applyApplicationUpdate(targetAppId),
          openPublication: async () => {
            const owner = await currentAccountId();
            const state = await loadSharing(targetAppId);
            if (!owner || await currentAccountId() !== owner || !state.application) throw new Error("请先完成作品制作");
            if (!shellNavigationRef.isReady()) throw new Error("页面尚未就绪，请重试");
            shellNavigationRef.navigate("marketDetail", { item: { manifest: state.application, authorId: owner, authorName: "", originalAppId: null, owned: true }, publish: true });
          },
          readPreference: (key: string) => {
            if (key !== "shell.companion.name.v1") throw new Error("制作偏好键无效");
            return readShellValue(key);
          },
          writePreference: (key: string, value: string) => {
            if (key !== "shell.companion.name.v1") throw new Error("制作偏好键无效");
            writeShellValue(key, value);
          },
        }) };
      }
      if (!Object.prototype.hasOwnProperty.call(modules, name)) throw new Error(`平台没有提供公共入口：${name}`);
      return modules[name]();
    },
    register: registerApplication,
  });
}
