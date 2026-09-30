import { bindApplicationSdk, registerApplication } from "../../../../packages/app-sdk/src/runtime";
import * as ui from "../../../../packages/app-sdk/src/ui";
import * as cloud from "../shell/cloudEvolve";
import { checkPackageUpdates, applyPackageUpdates } from "../shell/packageUpdates";
import { readShellValue, writeShellValue } from "../shell/shellStorage";

const modules: Record<string, unknown> = {
  react: require("react"),
  "react/jsx-runtime": require("react/jsx-runtime"),
  "react/jsx-dev-runtime": require("react/jsx-dev-runtime"),
  "react-native": require("react-native"),
  "react-native-svg": require("react-native-svg"),
  "react-native-markdown-display": require("react-native-markdown-display"),
  "react-native-reanimated": require("react-native-reanimated"),
  "react-native-linear-gradient": require("react-native-linear-gradient"),
  "react-native-safe-area-context": require("react-native-safe-area-context"),
  "react-native-video": require("react-native-video"),
  "react-native-worklets": require("react-native-worklets"),
  "@zijinhua/app-sdk/ui": ui,
};

export function installApplicationPlatform() {
  const target = globalThis as typeof globalThis & { __zijinhuaApplications?: unknown };
  if (target.__zijinhuaApplications) return;
  target.__zijinhuaApplications = Object.freeze({
    require: (name: string, appId: string) => {
      if (name === "@zijinhua/app-sdk") return bindApplicationSdk(appId);
      if (name === "@zijinhua/app-sdk/creation") {
        if (appId !== "jolly") throw new Error("当前应用未获得制作能力");
        return { getCreationService: () => ({ ...cloud, checkPackageUpdates, applyPackageUpdates,
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
      return modules[name];
    },
    register: registerApplication,
  });
}
