# 云端应用 Coding Agent 工作与交付要求

本文件面向 Jules 等云端 Coding Agent，不是本地维护者的操作限制。云端唯一开放仓库为 jiangfengwhu/zjh-dynamic，不访问或克隆 Android、server、旧单体仓库。跨仓库能力由本地维护者提供。

## 应用入口与 SDK

一次工坊心愿只交付一个应用。应用全部源码放在 packages/features/<appId>/，入口是 index.ts，使用 @zijinhua/app-sdk 的 defineApp；main 延迟返回页面组件，cards 与 avatar 由应用登记。application.json 记录稳定 appId、版本和展示信息；现有应用 ID 和用户数据不得改变。Jolly 也是独立应用，默认安装，工坊页面在其 Workshop.tsx。

新增应用执行 npm run init:application -- <appId>，生成最小模板并分配互不重叠的模块范围；不要修改其他应用已分配的范围。无需编辑宿主 registry。依照 packages/features/notepad 和 pomodoro 的入口开发。详细契约和限制见 docs/app-sdk-usage.md。

应用只导入 @zijinhua/app-sdk、@zijinhua/app-sdk/ui 及 tools/applications/public-modules.json 列出的公共第三方入口。getAppContext() 提供绑定当前应用的存储、动态、导航、资源 URI 和手机能力。禁止引用 vendor 内部文件、apps/mobile、packages/ui、packages/platform 或其他应用源码。制作服务 @zijinhua/app-sdk/creation 只授权 Jolly。需要其他原生能力时说明需求，由维护者扩展公开 SDK 和发布支持的 APK。

纯 JS 依赖可私有打入应用，按任务更新 apps/mobile/package.json 和锁文件；不能私有打包带原生实现的包，也不能复制 React/RN。共享入口禁止深层路径导入，版本必须与目标平台兼容。资源放在应用 assets/，用 ctx.assets.uri("文件名") 取得 URI；第一版不支持应用内 require 图片资源。动态正文和附件由应用绘制，平台不强加卡片边框。创作过程由 Jolly 在开始时生成一条动态并更新进度，失败或中断时删除；新应用安装不再额外发布欢迎动态，仅在工坊展示结果。

第一版不提供通用存储结构迁移；应用更新保持 dataSchemaVersion，任何破坏既有数据格式的变更须先由维护者设计迁移。存储键空间及动态身份由 SDK 绑定；升级、重载不清空用户数据。订阅和计时器在 React effect 的清理函数中释放。

## 必须发布，随后等待用户收下

用户提出新增、修改或修复应用时，默认要求发包，无需再要求用户说“发布”。只完成代码、构建成功或创建 PR 都不算交付。

1. 阅读相关代码并完成可用功能，包含加载、空态、错误反馈与持久化。默认不单独运行测试、类型检查或预览构建，用户在 App 验收；发布必需检查仍执行。安装使用 npm ci 与 npm ci --prefix apps/mobile。
2. 同步 main 与目标应用线上 source.commit，保留他人修改并处理冲突；提交全部源码改动，推送并按现有流程创建本次 PR。不要合入 main、强推或开始下一份心愿。
3. **执行 npm run publish:application -- <appId>**。命令负责独立 Metro/Hermes 构建、导入边界及目标平台兼容检查、应用提交基线检查、资源上传和清单发布，不用 npm run build:application 代替。
4. 核对线上 /v1/applications/<appId>/latest 的 source.commit 等于最终 PR head，source.dirty 为 false。只有包体上传和清单发布实际成功才报告已发布。任何后续源码提交（包括自动提交）都必须从最终 PR head 重新发布。
5. 用户先加载、体验，再在工坊确认收下。服务端核对该应用实际运行的 releaseId 与 PR head 后合入 main；不要绕过版本确认或替用户合入。调用 prompt 只传用户需求，固定要求来自本文件和 README。

缺少凭证、构建失败、依赖不兼容、基线不满足时保留代码和 PR，明确报告“代码已完成，发布未完成”及具体原因，不能将 Jules COMPLETED 当成上线成功。纯文档修改无需发布；已有待收下应用 PR 的 head 改变后仍必须重新发包。

## 宿主由维护者协调

apps/mobile 是平台宿主，packages/app-sdk 是公开契约与适配，packages/ui 和 platform 为平台内部实现，tools/applications 是独立应用工具。普通工坊任务不修改宿主、SDK、构建校验或运行时契约。需要改动这些能力时报告跨平台需求，不绕过检查。

维护者发布宿主仍使用 npm run publish，与 publish:application 分开。宿主运行时契约来自 /v1/runtime，桥接 SDK 下载后校验；不修改 release-migration.json、vendor 逻辑模块键或发布校验来绕过兼容性和提交基线。build-identity.json 为宿主自动生成标记，不提交、不手工维护。DEX 除非明确要求不扩展。

云端仅使用维护者注入的 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY、BUNDLE_CATALOG_TOKEN。不输出凭证、不获取管理权限、不运行 Wrangler 管理账户登录或直接写 KV；本机 Wrangler 回退仅供本地维护者使用。缺少权限时报告阻塞。最后用中文说明实现、实际发布结果和剩余限制。
