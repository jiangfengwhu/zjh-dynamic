import { bindApplicationSdk, registerApplication, setApplicationCreationNavigation } from "../../../../packages/app-sdk/src/runtime";
import { openCreationComposer } from "../shell/creationComposer";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { runningApplication } from "./applications";
import { applicationNativeModule, applicationReanimatedModule, applicationCalendarsModule } from "./applicationTypography";
import { installApplicationCloud } from "./applicationCloud";
import { installApplicationModuleLoader } from "./applicationModules";

const modules: Record<string, () => unknown> = {
  "react-hook-form": () => require("react-hook-form"),
  "@tanstack/react-query": () => require("@tanstack/react-query"),
  "react-native-enriched-markdown": () => require("react-native-enriched-markdown"),
  "react-native-nitro-web-image": () => require("react-native-nitro-web-image"),
  "@react-native-community/blur": () => require("@react-native-community/blur"),
  "@react-native-community/datetimepicker": () => require("@react-native-community/datetimepicker"),
  "@react-native-community/netinfo": () => require("@react-native-community/netinfo"),
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
  "react-native": applicationNativeModule,
  "react-native-calendars": applicationCalendarsModule,
  "react-native-gesture-handler": () => require("react-native-gesture-handler"),
  "react-native-gifted-charts": () => require("react-native-gifted-charts"),
  "react-native-image-crop-picker": () => require("react-native-image-crop-picker"),
  "react-native-keyboard-controller": () => require("react-native-keyboard-controller"),
  "@gorhom/bottom-sheet": () => require("@gorhom/bottom-sheet"),
  "react-native-permissions": () => require("react-native-permissions"),
  "react-native-audio-api": () => require("react-native-audio-api"),
  "react-native-vision-camera-barcode-scanner": () => require("react-native-vision-camera-barcode-scanner"),
  "react-native-nitro-image": () => require("react-native-nitro-image"),
  "react-native-pager-view": () => require("react-native-pager-view"),
  "react-native-pdf": () => require("react-native-pdf"),
  "react-native-qrcode-svg": () => require("react-native-qrcode-svg"),
  "react-native-reanimated": applicationReanimatedModule,
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
  "@zijinhua/app-sdk/ui": () => require("../../../../packages/app-sdk/src/host-ui"),
};

export function installApplicationPlatform() {
  const target = globalThis as typeof globalThis & { __zijinhuaApplications?: unknown };
  if (target.__zijinhuaApplications) return;
  installApplicationModuleLoader();
  installApplicationCloud();
  setApplicationCreationNavigation((appId, prompt) => {
    if (appId === "jolly") {
      const context = applicationContext("jolly");
      const target = prompt !== undefined ? context.storage.get("workshopTarget") : undefined;
      let workspace: { title: string; originalAppId?: string } | undefined;
      try { workspace = JSON.parse(context.storage.get("workspaces") || "[]").find((item: { appId: string }) => item.appId === target); } catch {}
      openCreationComposer(target && workspace ? { appId: target, title: workspace.title, originalAppId: workspace.originalAppId, fork: false, prompt } : undefined);
    } else {
      const manifest = runningApplication(appId);
      if (manifest) openCreationComposer({ appId, title: manifest.appName, releaseId: manifest.releaseId, prompt });
    }
  });
  target.__zijinhuaApplications = Object.freeze({
    require: (name: string, appId: string) => {
      if (name === "@zijinhua/app-sdk") return bindApplicationSdk(appId);
      if (name === "@zijinhua/app-sdk/creation") throw new Error("当前应用未获得制作能力");
      if (!Object.prototype.hasOwnProperty.call(modules, name)) throw new Error(`平台没有提供公共入口：${name}`);
      return modules[name]();
    },
    register: registerApplication,
  });
}
