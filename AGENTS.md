# 平台与 SDK 仓库边界

本仓库 jiangfengwhu/zjh-dynamic 维护独立 npm SDK、RN 宿主、加载器和打包发布工具。应用业务、Jolly、模板和工坊云端任务在 jiangfengwhu/zjh-plugin，按 apps/<id>/ 目录管理；本仓库不再新增应用业务。

沿用稳定应用 ID、数据键、模块范围与 runtime 契约。SDK 公共类型不得依赖宿主私有源码；实现适配可留在 host-ui.ts、runtime.ts，发布类型须自包含。源码与工具在本仓库维护，npm 包只包含 dist 和说明文档。

安装 npm ci、npm ci --prefix apps/mobile。SDK 发包使用 npm run pack:sdk 或 npm run publish:sdk；宿主发布使用 npm run publish。默认不单独运行类型检查、测试或预览，发布所需构建和兼容检查仍执行。

先提交源码再动态发布，source.commit 对应实际源码且 source.dirty 为 false。不绕过线上提交基线、兼容性检查、vendor 稳定模块键或工坊确认逻辑。SDK/API 或共享原生依赖变更需维护者协调 APK 与 server。纯文档修改无需发布。

不得输出凭证、硬编码密钥或擅自合入工坊 PR。云端应用 Agent 的具体实现、发布和交付要求以 zjh-plugin/AGENTS.md 为准。
