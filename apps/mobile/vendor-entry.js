import "react-native-get-random-values";
import "react-native-gesture-handler";
import "react-native-reanimated";
// Babel emits these for SDK/app UTF-8 chunk iteration; keep them in vendor.
require("@babel/runtime/helpers/awaitAsyncGenerator");
require("@babel/runtime/helpers/wrapAsyncGenerator");
require("@babel/runtime/helpers/asyncIterator");
import { AppRegistry, TurboModuleRegistry } from "react-native";
import { name as appName } from "./app.json";
import "./vendor-libs";
import { setShellError, ShellSlot } from "./src/runtime/shellSlot";

AppRegistry.registerComponent(appName, () => ShellSlot);

setTimeout(() => {
  const host = TurboModuleRegistry.get("NativePluginHost");
  if (!host || typeof host.call !== "function") {
    setShellError("原生桥还没准备好");
    return;
  }
  host.call("shell", "loadApp", "{}").then(
    (raw) => {
      console.log("app loaded", raw);
    },
    (error) => {
      const message = error instanceof Error ? error.message : String(error);
      setShellError(message);
    },
  );
}, 0);
