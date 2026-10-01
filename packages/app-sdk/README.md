# 紫金花应用 SDK

应用只依赖公开入口：`@zijinhua/app-sdk`、`@zijinhua/app-sdk/ui`、`@zijinhua/app-sdk/creation`。
SDK 提供应用契约、UI 类型及独立打包发布工具，不包含应用业务和宿主源码。

安装 SDK 后，插件仓库运行 `zjh-app init <id>`、`zjh-app build <id>`、`zjh-app publish <id>`。
每个应用位于 `apps/<id>/`，包含 `application.json`、`package.json`、`src/index.ts` 和可选的 `assets/`。
入口默认导出 `defineApp(...)`。图片、视频通过 `getAppContext().assets.uri(name)` 加载。

React、React Native 及平台共享原生依赖由宿主提供，版本记录在 `platform.json`；纯 JS 依赖可声明在应用清单中并随应用打包。
平台不兼容时发布会失败，不能通过改清单绕过。SDK 改动遵循语义版本，并与 APK 的运行时契约配套发布。
发布前必须提交全部源码，发布清单记录仓库、提交和依赖；不允许脏工作区发包或覆盖非祖先版本。

云端任务使用平台在制作轮次中签发的应用授权，先执行 `zjh-app authorize <id> '<grant>'`。授权只写入 Git 元数据目录，不输出或提交。SDK 1.1.8 通过服务端上传包体和候选清单，不使用共享 R2、BUNDLE_CATALOG_TOKEN 或 Wrangler 凭据。维护者仍可使用独立 OFFICIAL_PUBLISH_TOKEN。

Jolly 使用 `getCreationService(appId, originalAppId?)` 获取按应用隔离的制作服务。修改应用继续已有 session；新 appId 创建新 session。初始化前平台为 appId 原子分配模块范围，CLI 从 `/v1/application-allocation/<id>` 读取；不同应用不依靠本地目录扫描分配范围。

早期不要求兼容旧业务数据或迁移；应用 ID、模块范围与发布源码基线仍保持稳定。已收下的版本可显式分享，后续发包不会自动更新分享版本。

SDK 精确声明全部公开共享库、React 类型与 TypeScript。插件根 package.json 只声明 SDK，不重复安装或 overrides 改写这些依赖；应用 package.json 保留 name/private 与自身纯 JS 依赖，应用版本以 application.json 为准。标准公开库入口仍可直接导入，手机运行时由宿主提供，不随应用打包。

SDK npm 包的补丁版本可仅更新工具链；platform.json.sdk 表示所需的宿主 API 版本。包 1.1.8 仍使用运行时契约 1.1.0，原生与共享库版本保持一致；须与新的服务端发布接口协调上线。

### 候选发布与公开版本

`zjh-app publish <id>` 只上传候选包，不等于收下或上架。发布工具用本应用本轮授权读取私有候选基线并保持提交关系校验。云端必须继续发包，等待用户体验、收下并决定是否上架；不要调用官方公开发布接口、写入稳定指针。

候选发布携带 expectedReleases，服务端基线变化时返回 409；同步后重新构建发布，不覆盖或绕过基线。授权绑定 appId、账号、制作轮次和有效期，收下、暂停或开启新轮次后失效；不能修改其他应用、宿主或 vendor 编号表。原作复制锁定 originalReleaseId/originalCommit，由 init 读取对应 Git 提交。

应用在同一个 RN/JS 环境执行，appId 命名空间不构成恶意代码沙箱。当前开发阶段由开发者决定上架，不提供逐版本审核。作者体验候选、制作、收下和市场变更由宿主确认。未来 AI 恶意代码检测系统另行建设。Jolly 的工坊存储和订阅按账号分开，重新登录从服务端恢复所属作品。

Markdown 显示库使用平台维护的不可变 tarball：保持 7.0.2 的渲染源码及公开接口，仅将 markdown-it 更新至 15.0.2。platform.json.dependencyArtifacts 锁定产物地址和接口版本，SDK 自带安全依赖，应用无需 overrides。上游源码与许可证保留，构建时校验上游 SHA-512。

用户应用在 Jules 自动创建的应用分支持续迭代，不同步或合入 main。候选发包不再检查源码提交祖先或 PR 内容；保留本轮授权、expectedReleases 原子比较和运行时兼容校验。收下只选定已体验的 releaseId，作者主动决定是否上架。Remix 从原应用分支创建新应用，保留来源版本。

Linux/Windows 旧候选仅调试路径不同时，SDK 下载并校验原包，要求完整 Hermes 反汇编只差单个编译输入路径，其他发布配置、资源、版本、契约完全一致，才允许重建衔接。新包从固定 application.js 路径编译，不含机器绝对路径。
