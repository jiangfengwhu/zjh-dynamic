# SDK 仓库维护规则

适用于 zjh-dynamic 的 SDK 与宿主维护。应用业务在 zjh-plugin。

- SDK 公共类型必须自包含，不引用宿主私有源码。应用 ID、数据键、模块范围和 vendor 公共模块键保持稳定。
- 共享依赖由 SDK 固定版本；与平台契约保持一致，不绕过兼容检查。新增原生能力需协调 APK，涉及服务端协议或数据契约的变更需协调服务端。
- 安装、构建和发布命令见 [README.md](README.md)。默认不单独运行类型检查、测试或预览。
- 发布宿主动态包前提交源码，确保 source.commit 对应实际源码、source.dirty=false。应用发布流程遵循 zjh-plugin 的 AGENTS.md。
- 不输出或提交凭证，不硬编码密钥，不擅自合入应用 PR。
- 纯文档修改不发布宿主动态包；SDK 指引随 SDK 包分发。SDK 使用规则只维护在 [SDK README](packages/app-sdk/README.md)，共享库清单只维护在 [libraries.md](packages/app-sdk/libraries.md)。

# 宿主交互原则

完整视觉与交互约束见 [DESIGN.md](DESIGN.md)，维护宿主时遵循以下关键要求：

- 同层级的大片 UI 切换，适合横划时必须同时支持点击与原生跟手横划。保留各页独立状态和滚动位置，指示器复用分页进度；与纵向滚动、抽屉手势按触摸起点仲裁。筛选、外观设置等即时修改不强行套分页。
- 永远优先响应用户操作，非必要同步、预热和存储等响应后再执行。

## 云端应用 Agent 文档

- 云端应用 Agent 的操作流程只维护在 zjh-plugin 的 AGENTS.md，开发规则只维护在 SDK README。面向云端应用 Agent 的文档只包含当前工作必需的信息，优先封装为最少命令，不要求重复构建或让 Agent 执行维护者流程。
