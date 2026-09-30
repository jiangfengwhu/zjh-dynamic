# 动态仓库边界

只维护 RN 与动态应用，不加入 Android/iOS 工程、APK 版本配置、原生补丁、静态壳源码或服务端管理代码。
apps/mobile/ 放 RN 入口和容器；packages/features/ 放业务与注册表；packages/ui/ 放共享 UI；packages/platform/src/ 放现有原生能力适配。发布实现位于 tools/release/，命令入口位于 scripts/。
新增应用在 packages/features/<id>/app.tsx 实现并通过 packages/features/src/registry.ts 延迟加载登记。
运行时契约来自 /v1/runtime，桥接 SDK 下载后校验；不得修改契约绕过兼容性。只使用现有 APK 原生能力，新能力交给壳维护者发布 APK。
使用 npm run publish 发布，不绕过提交基线，不输出凭证，不自行强推或合并 PR。
Metro 保留稳定逻辑模块键，目录调整不能改变已发布 vendor 的编号。
本次迁移不新增测试文件，使用 npm run typecheck 和实际分包构建验证。
