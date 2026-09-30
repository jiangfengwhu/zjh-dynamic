# 动态仓库边界

本仓库 jiangfengwhu/zjh-dynamic 是云端 Agent 唯一开放的代码仓库。Android 和 server 由本地维护者管理；不访问、克隆或依赖这两个仓库及旧单体仓库，不要求用户向云端开放它们。跨仓库需求说明所需能力和接口，由用户交给本地维护者处理。

只维护 RN 与动态应用，不加入 Android/iOS 工程、APK 版本配置、原生补丁、静态壳源码或服务端管理代码。DEX 暂不扩展，除非用户明确提出相关任务。

## 实现入口

apps/mobile/ 放 RN 入口和容器；packages/features/ 放业务与注册表；packages/ui/ 放共享 UI；packages/platform/src/ 放现有原生能力适配。发布实现位于 tools/release/，命令入口位于 scripts/。

新增应用在 packages/features/<id>/app.tsx 实现，通过 packages/features/src/registry.ts 延迟加载登记；复用现有主题、卡片和持久化接口，保留既有应用 ID 与用户数据。

RN 依赖查 apps/mobile/package.json 和 apps/mobile/package-lock.json；根目录清单只管理发布工具。apps/mobile/vendor-libs.js 由打包脚本生成，不手工维护。先复用现有包；纯 JS 依赖按任务更新清单和锁文件。新增或升级带原生实现的包，需要本地壳维护者确认并发布支持它的 APK，不能宣称只发 RN 即可生效。

## 构建与发布

安装使用 npm ci 和 npm ci --prefix apps/mobile。代码修改使用 npm run typecheck 和必要的 npm run bundle 验证；默认不新增测试文件，用户明确要求时按其要求执行。纯文档修改无需打包或线上发布。

运行时契约来自 /v1/runtime，桥接 SDK 下载后校验；不得修改契约、release-migration.json 或发布校验来绕过兼容性和提交基线。Metro 保留稳定逻辑模块键，目录调整不能改变已发布 vendor 的编号。

任务要求动态发布时使用 npm run publish，不另写上传流程。先确保当前分支包含线上 source.commit；缺少提交时获取本仓库对应历史并按任务要求处理冲突，不覆盖他人改动。不得使用 --force 绕过基线；提交和 PR 按任务要求交付，不自行强推或合并 PR。

云端发布仅使用维护者注入的 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY 和 BUNDLE_CATALOG_TOKEN。不输出凭证、不获取管理权限、不运行 Wrangler 管理账户登录或直接写 KV；本机 Wrangler 回退是本地维护者流程。凭证缺失或权限不足时保留代码并报告阻塞，不绕过限制。仅命令和线上写入实际成功时报告发布成功。
