import type { AppContext } from "./index";

export function applicationCapabilities(appId: string): Pick<AppContext, "clipboard" | "haptics" | "toast" | "secureStorage" | "files"> {
  const blob = () => require("react-native-blob-util").default;
  const directory = () => `${blob().fs.dirs.DocumentDir}/applications/${appId}`;
  const pathFor = (path: string) => {
    if (!/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(path) || path.split("/").some(part => part === "." || part === "..")) throw new Error("应用文件路径无效");
    return `${directory()}/${path}`;
  };
  const ensureParent = async (path: string) => { const dir = path.slice(0, path.lastIndexOf("/")); if (!await blob().fs.exists(dir)) await blob().fs.mkdir(dir); };
  const serviceFor = (key: string) => {
    if (!key || key.length > 200) throw new Error("应用凭证键无效");
    return `com.zijinhua.applications.${appId}.${encodeURIComponent(key)}`;
  };
  return {
    clipboard: { get: () => require("@react-native-clipboard/clipboard").default.getString(), set: text => require("@react-native-clipboard/clipboard").default.setString(text) },
    haptics: { trigger: kind => require("react-native-haptic-feedback").default.trigger(kind, { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }) },
    toast: { show: (text, kind = "info") => require("react-native-toast-message").default.show({ type: kind, text1: text, position: "bottom" }) },
    secureStorage: {
      get: async key => { const value = await require("react-native-keychain").getGenericPassword({ service: serviceFor(key) }); return value ? value.password : undefined; },
      set: async (key, value) => { await require("react-native-keychain").setGenericPassword(appId, value, { service: serviceFor(key) }); },
      remove: async key => { await require("react-native-keychain").resetGenericPassword({ service: serviceFor(key) }); },
    },
    files: {
      uri: path => `file://${pathFor(path)}`,
      readText: path => blob().fs.readFile(pathFor(path), "utf8"),
      writeText: async (path, text) => { const target = pathFor(path); await ensureParent(target); await blob().fs.writeFile(target, text, "utf8"); },
      remove: async path => { const target = pathFor(path); if (await blob().fs.exists(target)) await blob().fs.unlink(target); },
      list: async () => await blob().fs.exists(directory()) ? blob().fs.ls(directory()) : [],
      download: async (url, path) => { if (!/^https:\/\//i.test(url)) throw new Error("下载地址必须使用 HTTPS"); const target = pathFor(path); await ensureParent(target); const result = await blob().config({ path: target }).fetch("GET", url); if (result.info().status < 200 || result.info().status >= 300) { await blob().fs.unlink(target); throw new Error("下载失败"); } },
    },
  };
}
