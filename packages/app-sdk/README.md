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

Jolly 使用 `getCreationService(appId, originalAppId?)` 获取按应用隔离的制作服务。修改应用继续已有 session；新 appId 创建新 session。初始化前平台为 appId 原子分配模块范围，CLI 从 `/v1/application-allocation/<id>` 读取；不同应用不依靠本地目录扫描分配范围。

早期不要求兼容旧业务数据或迁移；应用 ID、模块范围与发布源码基线仍保持稳定。已收下的版本可显式分享，后续发包不会自动更新分享版本。

SDK 精确声明全部公开共享库、React 类型与 TypeScript。插件根 package.json 只声明 SDK，不重复安装或 overrides 改写这些依赖；应用 package.json 保留 name/private 与自身纯 JS 依赖，应用版本以 application.json 为准。标准公开库入口仍可直接导入，手机运行时由宿主提供，不随应用打包。

SDK npm 包的补丁版本可仅更新工具链；platform.json.sdk 表示所需的宿主 API 版本。本次包 1.1.1 仍使用运行时契约 1.1.0，原生与共享库版本保持一致。

### 候选发布与公开版本

`zjh-app publish <id>` 只上传候选包，不等于收下或上架。发布工具用 BUNDLE_CATALOG_TOKEN 读取私有候选基线并保持提交关系校验；维护者可使用独立 OFFICIAL_PUBLISH_TOKEN。SDK 1.1.2 更新的是发布工具，运行时 SDK 契约仍为 1.1.0。云端必须继续发包，等待用户体验、收下并主动分享；不要调用官方公开发布接口或写入稳定指针。

SDK 1.1.3 的候选发布携带 expectedReleases，服务端基线变化时返回 409；同步后重新构建发布，不覆盖或绕过基线。云端应用凭证只允许应用清单，不能发布宿主和 vendor 编号表。
