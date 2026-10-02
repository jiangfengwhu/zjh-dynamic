# 紫金花应用 SDK

应用只依赖公开入口：`@zijinhua/app-sdk`、`@zijinhua/app-sdk/ui`、`@zijinhua/app-sdk/creation`。
SDK 提供应用契约、UI 类型及独立打包发布工具，不包含应用业务和宿主源码。

安装 SDK 后，插件仓库运行 `zjh-app init <id>`、`zjh-app build <id>`、`zjh-app publish <id>`。
每个应用位于 `apps/<id>/`，包含 `application.json`、`package.json`、`src/index.ts` 和可选的 `assets/`。
入口默认导出 `defineApp(...)`。图片、视频通过 `getAppContext().assets.uri(name)` 加载。

React、React Native 及平台共享原生依赖由宿主提供，版本记录在 `platform.json`；纯 JS 依赖可声明在应用清单中并随应用打包。
平台不兼容时发布会失败，不能通过改清单绕过。SDK 改动遵循语义版本，并与 APK 的运行时契约配套发布。
发布前必须提交全部源码，发布清单记录仓库、提交和依赖；不允许脏工作区发包或覆盖非祖先版本。

云端任务使用平台在制作轮次中签发的应用授权，先执行 `zjh-app authorize <id> '<grant>'`。授权只写入 Git 元数据目录，不输出或提交。SDK 1.1.9 通过服务端上传包体和候选清单，不使用共享 R2、BUNDLE_CATALOG_TOKEN 或 Wrangler 凭据。维护者仍可使用独立 OFFICIAL_PUBLISH_TOKEN。

Jolly 使用 `getCreationService(appId, originalAppId?)` 获取按应用隔离的制作服务。修改应用继续已有 session；新 appId 创建新 session。初始化前平台为 appId 原子分配模块范围，CLI 从 `/v1/application-allocation/<id>` 读取；不同应用不依靠本地目录扫描分配范围。

制作服务提供 `readWorkshopDetail(session, cachedOnly?)`，聚合会话、进度记录、交付和公开版本；`readWorkshopHistory(session, cursor)` 按需加载更多记录。轮询可用 `shouldPause` 暂停隐藏页面的同步，暂停不会停止云端制作。缓存仅用于展示，不代替写操作的实时鉴权。

### 使用用户配置的 AI（宿主 API 1.3.0）

所有应用通过 `getAppContext().ai` 复用「我的 → AI 引擎」配置，不需要自己的 API Key 设置页或 AI HTTP 客户端。密钥由原生宿主保存和使用，SDK 不提供读取或修改凭证的 API。

```ts
const ai = getAppContext().ai;
const providers = await ai.listProviders(); // id、name、model、isDefault，不含密钥或地址
if (!providers.length) {
  // 在用户点击“配置 AI”时调用；不要在浏览页面时自动跳转。
  ai.openSettings();
} else {
  const result = await ai.complete({
    messages: [
      { role: "system", content: "将用户想法整理成简洁的需求，不擅自增加功能。" },
      { role: "user", content: "做一个个人记账应用" },
    ],
    maxTokens: 2048,
  });
  if (result.ok) { /* 将 result.text 展示给用户 */ }
  else if (result.code === "NOT_CONFIGURED") { /* 显示配置入口，保留用户输入 */ }
  else { /* 展示 result.error，允许用户手动重试 */ }
}
```

不传 providerId 时每次调用读取当前默认模型；可从 listProviders 选择 providerId，已删除的选择返回 PROVIDER_NOT_FOUND，不偷偷切换其他模型。messages 支持 system/user/assistant，多轮对话历史由应用提供；每次最多 128 条、合计 128000 字符。temperature 可选 0–2，maxTokens 可选整数 1–8192；未指定时沿用服务商默认参数。不同模型可能不支持这些参数，失败时应提示并允许调整。

complete 返回可辨别联合结果，成功包含 text/providerId/model；失败 code 为 NOT_CONFIGURED、PROVIDER_NOT_FOUND、INVALID_REQUEST、AUTH_FAILED、RATE_LIMITED、TIMEOUT、NETWORK_ERROR、INVALID_RESPONSE、PROVIDER_ERROR 或 BUSY。listProviders 读取失败会抛出错误。每应用最多同时两次请求，宿主 SDK 全局最多四次；不自动重试，避免重复消耗额度。原生连接超时 20 秒，读响应超时 120 秒。首版为 OpenAI 兼容的非流式文本对话，不提供图片、工具调用、取消或流式输出；应用显示 loading，离开页面后忽略过期结果。

请求从本机直接发送到用户配置的 HTTPS 服务商，不经过紫金花服务端。服务商可收取模型费用；应用应在用户明确使用 AI 功能时请求，并保持原输入、失败提示和配置入口。修改全局 AI 设置只通过宿主配置页。SDK 命名空间是工程边界，共享 JS 环境不是恶意代码安全沙箱。

早期不要求兼容旧业务数据或迁移；应用 ID、模块范围与发布源码基线仍保持稳定。作者可以直接上架已发布的候选版本，后续发包不会自动更新分享版本。

SDK 精确声明全部公开共享库、React 类型与 TypeScript。插件根 package.json 只声明 SDK，不重复安装或 overrides 改写这些依赖；应用 package.json 保留 name/private 与自身纯 JS 依赖，应用版本以 application.json 为准。标准公开库入口仍可直接导入，手机运行时由宿主提供，不随应用打包。

SDK npm 包的补丁版本可仅更新工具链；platform.json.sdk 表示所需的宿主 API 版本。包 1.1.10 仍使用运行时契约 1.1.0，原生与共享库版本保持一致；须与新的服务端发布接口协调上线。

### 候选发布与公开版本

`zjh-app publish <id>` 只上传候选包，不会自动上架。发布工具用本应用本轮授权读取私有候选基线并保持候选 CAS 校验。云端必须继续发包，由作者决定是否体验或上架；不要调用官方公开发布接口、写入稳定指针。

候选发布携带 expectedReleases，服务端基线变化时返回 409；同步后重新构建发布，不覆盖或绕过基线。授权绑定 appId、账号、制作轮次和有效期，制作完成、暂停或开启新轮次后失效；不能修改其他应用、宿主或 vendor 编号表。原作复制锁定 originalReleaseId/originalCommit，由 init 读取对应 Git 提交。

应用在同一个 RN/JS 环境执行，appId 命名空间不构成恶意代码沙箱。当前开发阶段由开发者决定上架，不提供逐版本审核。作者在制作界面主动提交需求、体验候选，并在宿主发布表单明确选择公开版本；这些操作不重复弹窗确认。停止、撤回等操作保留确认。未来 AI 恶意代码检测系统另行建设。Jolly 的工坊存储和订阅按账号分开，重新登录从服务端恢复所属作品。

Markdown 显示库使用平台维护的不可变 tarball：保持 7.0.2 的渲染源码及公开接口，仅将 markdown-it 更新至 15.0.2。platform.json.dependencyArtifacts 锁定产物地址和接口版本，SDK 自带安全依赖，应用无需 overrides。上游源码与许可证保留，构建时校验上游 SHA-512。

用户应用在 Jules 自动创建的应用分支持续迭代，不同步或合入 main。候选发包不再检查源码提交祖先或 PR 内容；保留本轮授权、expectedReleases 原子比较和运行时兼容校验。作者可以直接体验、继续修改或上架候选版本。Remix 从原应用分支创建新应用，保留来源版本。

Linux/Windows 旧候选仅调试路径不同时，SDK 下载并校验原包，要求完整 Hermes 反汇编只差单个编译输入路径，其他发布配置、资源、版本、契约完全一致，才允许重建衔接。新包从固定 application.js 路径编译，不含机器绝对路径。

制作服务的 checkPackageUpdates/applyPackageUpdates 只处理绑定的目标应用，不检查或应用宿主更新及其他作品。openPublication 打开宿主发布表单，显示并锁定所选候选版本；尚未体验也可发布。

共享库清单、固定版本与使用示例见 [libraries.md](dist/libraries.md)。安装 SDK 后亦可读取 `@zijinhua/app-sdk/libraries.md` 与 `@zijinhua/app-sdk/platform.json`。
