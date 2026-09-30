# 紫金花应用 SDK

应用只依赖公开入口：`@zijinhua/app-sdk`、`@zijinhua/app-sdk/ui`、`@zijinhua/app-sdk/creation`。
SDK 提供应用契约、UI 类型及独立打包发布工具，不包含应用业务和宿主源码。

安装 SDK 后，插件仓库运行 `zjh-app init <id>`、`zjh-app build <id>`、`zjh-app publish <id>`。
每个应用位于 `apps/<id>/`，包含 `application.json`、`package.json`、`src/index.ts` 和可选的 `assets/`。
入口默认导出 `defineApp(...)`。图片、视频通过 `getAppContext().assets.uri(name)` 加载。

React、React Native 及平台共享原生依赖由宿主提供，版本记录在 `platform.json`；纯 JS 依赖可声明在应用清单中并随应用打包。
平台不兼容时发布会失败，不能通过改清单绕过。SDK 改动遵循语义版本，并与 APK 的运行时契约配套发布。
发布前必须提交全部源码，发布清单记录仓库、提交和依赖；不允许脏工作区发包或覆盖非祖先版本。

云端发布需要维护者注入 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY、BUNDLE_CATALOG_TOKEN；不向应用暴露这些凭证。
