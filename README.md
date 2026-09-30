# 紫金花动态应用

本仓库包含 RN 界面与业务逻辑、共享组件、应用、DEX 插件源码，以及动态包构建发布工具。Android 静态壳独立维护，本仓库不包含 Android 工程、APK 版本配置、原生依赖补丁、服务端源码或原单体仓库历史。

## 开发与发布

需要 Node.js 22+。

1. `npm ci` 和 `npm ci --prefix mobile` 安装工具和 RN 依赖。
2. `npm run bundle` 本地构建 RN 包，输出位于 `out/bundle`。
3. `npm run publish` 或 `npx tsx scripts/cloud-publish.ts` 发布动态包。

发布前读取 `/v1/runtime` 的兼容版本和桥接 SDK，不自行生成 APK 指纹。发布脚本检查线上来源提交必须是当前提交的祖先；不支持跳过基线的 `--force`。仅迁移时允许覆盖 `release-migration.json` 精确指定的旧版 release，迁移后使用本仓库自己的提交历史。

R2 上传可使用环境变量 `R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`，否则使用本机已登录的 Wrangler。清单发布使用 `BUNDLE_CATALOG_TOKEN`，本机也可使用 Wrangler。配置示例在 `.env.example`；不要提交凭证。

## DEX

插件位于 `plugins/<id>/plugin.json` 和 `plugins/<id>/src/*.java`。有插件需要编译时配置 `JAVA_HOME` 和 `ANDROID_HOME`。桥接编译 SDK 从运行时契约指定的不可变地址下载并验证 SHA-256，不需要 Android 壳源码。

## 云端 Agent

App 的云端会话来源固定为 `sources/github/jiangfengwhu/zjh-dynamic`。生成应用继续使用 `features/<id>/app.tsx` 并在 `features/src/registry.ts` 登记。需要静态原生能力时交给壳维护者发布 APK，不向本仓库添加 Android 工程。
