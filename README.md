# 紫金花动态应用

维护 RN 界面与业务和动态发布工具。Android 静态壳在 [zjh-android](https://github.com/jiangfengwhu/zjh-android)，服务端在 [zjh-server](https://github.com/jiangfengwhu/zjh-server)。本仓库及其历史不包含原生工程、APK 配置、原生依赖补丁或服务端源码。

只有本仓库向云端 Agent 开放。上面的仓库链接用于说明职责，不是云端任务的工作入口；完成动态任务不需要访问、克隆或查询其他仓库。需要跨仓库配合时，由用户交给本地维护者处理。

## 目录与依赖

| 路径 | 职责 |
| --- | --- |
| apps/mobile/ | RN 入口、导航、动态容器界面和 Metro 配置 |
| packages/features/ | 业务应用、头像、卡片与延迟加载注册表 |
| packages/ui/ | 共享组件、主题和展示状态 |
| packages/platform/src/ | 现有 APK 能力的 RN 适配接口 |
| tools/release/ | 分包、兼容性校验、SDK 下载及上传实现 |
| scripts/ | 本地构建和线上发布的命令入口 |
| plugins/ | 将来维护的 DEX 插件；本次不迁移 DEX |
| dist/ | bundles、SDK 和插件编译产物；不进入 Git |

应用入口组合 features、ui 和 platform；platform 适配现有原生能力，不依赖业务应用。新增应用使用 packages/features/<id>/app.tsx，并在 packages/features/src/registry.ts 登记，load 使用延迟 require。

### 已引入的 RN 包

- [apps/mobile/package.json](apps/mobile/package.json) 的 dependencies 列出 RN 应用依赖与版本范围，devDependencies 列出开发工具。
- [apps/mobile/package-lock.json](apps/mobile/package-lock.json) 锁定精确版本和传递依赖，安装使用 npm ci。
- [apps/mobile/vendor-libs.js](apps/mobile/vendor-libs.js) 是打包脚本生成的 vendor 引入清单，不作为手工维护的依赖清单。
- 根目录 package.json 和 package-lock.json 管理发布工具依赖，与 RN 应用依赖分开。

优先复用上述包和 packages/platform/src 的现有能力。纯 JS 依赖可按任务需要更新 RN 清单与锁文件；增加或升级含原生实现的包不能仅靠 RN 发布生效，需要本地壳维护者确认 APK 支持并协调版本。云端 Agent 不通过复制原生源码或添加补丁来解决。

## 开发与发布

需要 Node.js 22+。

1. `npm ci` 和 `npm ci --prefix apps/mobile` 安装发布工具与 RN 依赖。
2. 完成功能后提交源码；默认不单独运行验证，由用户在 App 中验收。
3. `npm run publish` 构建并发布线上动态包；命令入口为 scripts/cloud-publish.ts。用户要求时才单独运行 `npm run typecheck` 或 `npm run bundle`。

仅修改文档时无需构建或发布 RN 包。提交、PR 和推送遵循当前任务的交付要求，不自行合并 PR 或强推。

工坊一次只制作一份心愿。Jules 完成后创建 PR，并从最终源码提交发布；用户加载最新作品后，在工坊点击「确认收下并合入」。服务端核对当前运行代码的 buildId、线上清单、会话和 PR head，使用普通 merge 合入 main，再允许下一次制作。待确认状态跨 App 重载保留，不能通过重开会话跳过。

build-identity.json 由构建流程生成并嵌入当前 app 包，清单 source.buildId 记录同一标记；文件不进入 Git，不手工修改。不以「已经下载」或「没有更新提示」代替运行版本核对。

发布前读取 /v1/runtime 的兼容版本与桥接 SDK，不自行生成 APK 指纹。发布检查线上提交必须是当前提交的祖先，不支持 --force。release-migration.json 只允许精确指定的旧单体 release 迁移一次。

Metro 的模块编号使用稳定逻辑路径，目录搬迁保持已发布 vendor 的编号，避免已安装 APK 的分包错配。原生依赖或能力的变化仍需要静态壳维护者发布 APK。

云端发布环境由维护者配置 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY 和 BUNDLE_CATALOG_TOKEN。变量示例在 .env.example，实际值通过环境注入；该文件本身不会自动配置凭证。不得输出或提交凭证。

维护者本机可以使用已登录的 Wrangler 回退上传和写清单。这个回退使用账户管理权限，不是云端权限配置方案；云端 Agent 不尝试登录管理账户、获取管理凭证或直接写 KV。缺少发布凭证时保留完成的代码，报告具体阻塞，不绕过权限或兼容性检查。

## 云端 Agent

App 的云端会话来源固定为 sources/github/jiangfengwhu/zjh-dynamic。Agent 先读本仓库 AGENTS.md，再按目录和依赖清单完成任务，只修改动态代码。其他仓库和旧单体仓库均不作为云端任务的依赖。

维护者须将用于云端 Agent 的仓库授权限制到 zjh-dynamic，并配置动态发布所需的最小权限；不注入 Android/server 管理凭证。服务端代理的来源限制与本仓库指引不能代替集成账户和凭证本身的权限限制。

未来 DEX 插件放在 plugins/<id>/plugin.json 与 src/*.java，编译仅下载校验后的桥接 SDK，不依赖壳源码。
