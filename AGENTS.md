# SDK 仓库维护规则

适用于 zjh-dynamic 的 SDK 与宿主维护。应用业务在 zjh-plugin。

- SDK 公共类型必须自包含，不引用宿主私有源码。应用 ID、数据键、模块范围和 vendor 公共模块键保持稳定。
- 共享依赖由 SDK 固定版本；与平台契约保持一致，不绕过兼容检查。新增原生能力需协调 APK，接口变更需协调服务端。
- 安装、构建和发布命令见 README.md。默认不单独运行类型检查、测试或预览。
- 发布前提交源码，确保 source.commit 对应实际源码、source.dirty=false。
- 不输出或提交凭证，不硬编码密钥，不擅自合入应用 PR。
- 纯文档修改不发布。SDK 使用规则只维护在 packages/app-sdk/README.md，共享库清单只维护在 packages/app-sdk/libraries.md。
