# zjh-dynamic

紫金花 SDK 与平台宿主仓库，负责稳定 API、运行时适配、共享 UI、应用加载与 SDK 构建发布。应用业务已迁至 [zjh-plugin](https://github.com/jiangfengwhu/zjh-plugin)，按 apps/<id>/ 目录管理，模板位于 templates/basic。

| 目录 | 职责 |
| --- | --- |
| packages/app-sdk | 独立 npm SDK 的公共类型与运行时适配 |
| apps/mobile | RN 平台入口、容器、应用安装和加载 |
| packages/features/src | 应用元数据与延迟加载注册表 |
| packages/ui、packages/platform | 平台 UI 与原生能力适配 |
| tools/applications | 打进 npm SDK 的独立应用工具 |
| tools/release | 宿主发布流程 |

npm ci 与 npm ci --prefix apps/mobile 安装平台依赖。npm run pack:sdk 构建可独立安装的 @zijinhua/app-sdk npm 包；npm run publish:sdk 发布 npm registry，需维护者登录及权限。当前插件仓库使用固定哈希的 CDN npm tarball。npm run publish 更新宿主，不能代替插件仓库的应用发布。

工坊新会话来源为 sources/github/jiangfengwhu/zjh-plugin，云端只开放该仓库。应用开发输入、逐应用发包和 PR 规则见插件仓库 AGENTS.md。平台变更由本地维护者协调 Android/server，不把这些仓库作为应用开发依赖。

依赖与兼容规则见 [SDK 使用说明](docs/app-sdk-usage.md)。SDK 版本、RN/Hermes ABI 和共享原生依赖与 /v1/runtime 保持一致；不通过修改提交基线、vendor 编号或校验绕过不兼容。新增原生实现仍需发布支持的 APK。

制作服务按 appId 隔离 session、凭据、进度与收下状态；同一应用复用 session，新应用建立新 session。不同应用并行制作，模块范围由服务端原子预留，合入串行核对冲突。

市场分享固定在用户已收下的 releaseId，修改不会自动更新公开版本；拥有本机 session 凭据的应用跟踪制作包，市场用户只跟踪公开分享。作者暂用默认值，不接登录。早期不维护旧业务数据兼容或迁移。

“我的作品与应用”分别管理创作作品和市场安装。作品列表保留尚未发包的草稿，按制作、等待回复、体验、收下等状态进入工坊。市场仅展示公开分享；创作者可更新到已收下版本、编辑分享信息或撤回，编辑不改变公开版本，撤回不删除作品或本机数据。
