# 动态仓库边界

本仓库只维护 RN 和 DEX 动态应用。不得加入 Android/iOS 工程、APK 版本配置、原生依赖补丁、静态壳实现或服务端管理代码。
运行时契约来自 /v1/runtime，桥接 SDK 为下载的构建依赖；不能修改契约来绕过兼容性检查。
只使用现有 APK 原生能力。需要新的静态原生能力时说明需要壳维护者发布 APK，不宣称动态包已实现该能力。
沿用 features、components、mobile/src/shell 结构；新增应用延迟加载并登记动态卡片。
发布使用 npx tsx scripts/cloud-publish.ts；不绕过提交基线，不输出凭证，不自行强推或合并 PR。
本次迁移不新增测试文件；使用类型检查、构建和已授权的真机验证。
