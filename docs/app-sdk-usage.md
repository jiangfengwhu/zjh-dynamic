# 应用 SDK 使用说明

@zijinhua/app-sdk 是独立 npm 包，源码与构建工具位于 zjh-dynamic；应用位于 zjh-plugin/apps/<id>/，根 npm workspace 管理安装和锁文件，模板在 templates/basic。Jolly 是默认安装的独立应用。

AI Coding 获得目标应用、插件仓库 AGENTS.md 与 README、已安装 SDK 的公开类型和 platform.json、模板及根锁文件，无需访问宿主或 SDK 源码。

运行 npm ci 安装；npm run init:application -- <id> 创建应用，编辑 src/index.ts 和页面。入口默认导出 defineApp({ main: () => require('./app').default })。公共入口为 @zijinhua/app-sdk、/ui、/creation，UI 可选，应用可自行绘制动态。getAppContext 提供按应用隔离的存储、动态、导航、资源和手机能力；制作服务只授权 Jolly。

React/RN 及 platform.json 中的共享原生库由宿主提供，额外纯 JS 依赖写入目标应用 package.json，随应用打包。不能引用 vendor 内部文件、其他应用或宿主源码。SDK 工具链版本固定，构建时核对开发 React/RN 版本，发布时再核对目标 /v1/runtime。

assets/ 按 SHA-256 发布，通过 ctx.assets.uri(name) 使用，不支持 require 图片。现有应用 ID、数据键和模块范围保持不变；同进程只运行一个应用版本，更新后重载 JS。

提交全部源码后运行 npm run publish:application -- <id>。发布清单绑定 repository、commit 与干净工作区，源码树须对应最终 PR，收下时锁定 PR head。线上基线必须为当前提交祖先。候选由 Durable Object 保存权威基线；不接受跨仓库历史迁移。

兼容判定包含 RN/Hermes engineAbi、SDK 同主版本且宿主版本不低于应用需求、应用实际引用的共享依赖精确版本。无关共享依赖增加不影响旧包；所用共享依赖升级或 ABI/SDK 主版本变化需应用适配。SDK npm 包升级不会自动更新所有应用，由插件仓库显式更新锁文件和重发受影响应用。

已有包失败回滚由平台加载器处理；不允许直接改变 dataSchemaVersion。JS 运行环境共享，工程隔离不是恶意代码沙箱。开发阶段自动打包候选，由开发者体验、收下并决定上架；当前不做审核，未来 AI 检测另行建设。公开版本绑定 releaseId、包哈希和源码提交；制作与市场变更由宿主确认。工坊记录按账号保存，服务端恢复所属作品。加载器保留网络故障时的待加载记录，页面挂载后确认健康；失败版本阻止重试并恢复上一版，有旧版时重载 JS。

SDK 可通过 npm run pack:sdk 生成 tarball；当前插件依赖 CDN 固定哈希地址，npm registry 公开发布需维护者登录。工坊任务只能在插件仓库逐应用发布，用户体验后确认收下再合入 main。

共享依赖归 SDK 统一管理：plugin 根 package.json 仅依赖固定 SDK，SDK 精确安装共享 RN 库、React 类型与 TypeScript。各应用 package.json 仅声明 workspace 身份及其额外纯 JS 依赖，application.json 管理应用版本。CLI 在构建前校验声明和实际安装版本，拒绝重复共享依赖、共享库 npm 别名及 overrides；共享库内部路径不能打入应用。

SDK 工具包补丁版本与运行时 API 最低版本可分开：npm 包 1.1.6 的 platform.json.sdk 仍为 1.1.0，共享原生依赖未变化。SDK 与新的服务端接口、宿主确认流程须协调上线；发布顺序及旧凭据撤销见 [市场信任与发布流程](market-trust.md)。
