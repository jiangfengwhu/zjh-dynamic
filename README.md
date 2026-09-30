# 紫金花动态应用

维护 RN 界面与业务和动态发布工具。Android 静态壳在 [zjh-android](https://github.com/jiangfengwhu/zjh-android)，服务端在 [zjh-server](https://github.com/jiangfengwhu/zjh-server)。本仓库及其历史不包含原生工程、APK 配置、原生依赖补丁或服务端源码。

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

## 开发与发布

需要 Node.js 22+。

1. `npm ci` 和 `npm ci --prefix apps/mobile` 安装发布工具与 RN 依赖。
2. `npm run typecheck` 检查发布工具和 RN 代码。
3. `npm run bundle` 本地构建到 dist/bundles。
4. `npm run publish` 发布线上动态包；命令入口仍为 scripts/cloud-publish.ts。

发布前读取 /v1/runtime 的兼容版本与桥接 SDK，不自行生成 APK 指纹。发布检查线上提交必须是当前提交的祖先，不支持 --force。release-migration.json 只允许精确指定的旧单体 release 迁移一次。

Metro 的模块编号使用稳定逻辑路径，目录搬迁保持已发布 vendor 的编号，避免已安装 APK 的分包错配。原生依赖或能力的变化仍需要静态壳维护者发布 APK。

R2 上传可配置 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY；清单发布使用 BUNDLE_CATALOG_TOKEN。本机也可使用已登录的 Wrangler。变量示例在 .env.example，不提交凭证。

## 云端 Agent

App 的云端会话来源固定为 sources/github/jiangfengwhu/zjh-dynamic。Agent 只在这个仓库修改动态代码；服务端代理拒绝其他仓库的会话请求。真正的 GitHub/Jules 仓库访问范围仍需账户管理员在集成授权中限制，目录隔离本身不替代账户权限。

未来 DEX 插件放在 plugins/<id>/plugin.json 与 src/*.java，编译仅下载校验后的桥接 SDK，不依赖壳源码。
