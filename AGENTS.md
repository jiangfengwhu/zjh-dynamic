# 云端 Coding Agent 工作与交付要求

本文件面向 Jules 等在云端执行本仓库任务的 Coding Agent。它规定云端工作范围与交付流程，不是本地维护者的操作限制。

## 必须完成的交付

用户从 App 工坊提出新增应用、修改功能或修复问题时，默认要求发布可在手机中加载的动态包，用户不必额外说“发包”。只完成代码、通过类型检查、运行 `npm run bundle` 或创建 PR，都不算完成交付。

交付顺序：

1. 阅读相关代码并实现需求；默认不单独运行测试、类型检查或预览构建。
2. 同步本仓库最新 `main` 和线上清单的 `source.commit`，保留已有修改；处理冲突后提交全部源码改动。
3. 推送最终提交并按现有流程创建或更新本次 PR，保持 PR 待用户确认，不合入 `main`。
4. **必须执行 `npm run publish`**。该命令负责发布所需构建、兼容性检查、包体上传和线上清单更新，不能用 `npm run bundle` 代替。
5. 发布成功后核对线上 `/v1/release`：`source.commit` 必须等于本次 PR 最终 head，`source.dirty` 必须为 `false`。只有上传和清单更新均成功，才向用户报告“已发布，可以加载体验”。
6. 若发布后产生任何新的 Git 提交（包括文档、自动提交或 submit 工具产生的提交），必须从最终 PR head 重新运行 `npm run publish`，否则工坊不能确认收下。

缺少发布凭证、上传失败、基线或兼容性检查失败时，保留代码和 PR，明确报告“代码已完成，发布未完成”、失败原因及需要维护者处理的事项。不得把 Jules 的 `COMPLETED`、提交成功、PR 创建成功或构建成功描述为新作品已上线，也不得隐瞒失败后结束交付。纯文档任务无需发布；但修改已有待收下 PR 的 head 后，仍需重新发布以保持版本一致。

## 动态仓库边界

本仓库 jiangfengwhu/zjh-dynamic 是云端 Agent 唯一开放的代码仓库。Android 和 server 由本地维护者管理；不访问、克隆或依赖这两个仓库及旧单体仓库，不要求用户向云端开放它们。跨仓库需求说明所需能力和接口，由用户交给本地维护者处理。

只维护 RN 与动态应用，不加入 Android/iOS 工程、APK 版本配置、原生补丁、静态壳源码或服务端管理代码。DEX 暂不扩展，除非用户明确提出相关任务。

## 实现入口

先阅读相关代码，理解用户希望得到的实际行为；沿用现有架构、组件和主题，完成可使用的功能，包括必要的数据持久化、权限处理、加载、空态和错误反馈。需求不明确时采用符合现有产品的合理默认值；涉及关键歧义或缺少必要条件时询问用户。手机能力优先复用 packages/platform/src 和现有 shell 封装，按需申请权限；不虚构接口、硬编码凭证或用演示数据冒充真实功能，只修改完成需求所需的文件。

apps/mobile/ 放 RN 入口和容器；packages/features/ 放业务与注册表；packages/ui/ 放共享 UI；packages/platform/src/ 放现有原生能力适配。发布实现位于 tools/release/，命令入口位于 scripts/。

新增应用在 packages/features/<id>/app.tsx 实现并调用 registerFeature(id, Component)，通过 packages/features/src/registry.ts 延迟加载登记；动态卡片和头像参考 packages/features/jolly 的登记方式。复用现有主题、卡片和持久化接口，保留既有应用 ID、用户数据和其他功能。

RN 依赖查 apps/mobile/package.json 和 apps/mobile/package-lock.json；根目录清单只管理发布工具。apps/mobile/vendor-libs.js 由打包脚本生成，不手工维护。先复用现有包；纯 JS 依赖按任务更新清单和锁文件。新增或升级带原生实现的包，需要本地壳维护者确认并发布支持它的 APK，不能宣称只发 RN 即可生效。

## 构建与发布

安装使用 npm ci 和 npm ci --prefix apps/mobile。默认不单独运行类型检查、测试或预览构建，完成修改后直接运行发布流程，由用户在 App 中验收；发布必需的构建与兼容性检查仍执行，不绕过失败或提交基线。用户明确要求验证时按其要求执行。纯文档修改无需打包或线上发布。

运行时契约来自 /v1/runtime，桥接 SDK 下载后校验；不得修改契约、release-migration.json 或发布校验来绕过兼容性和提交基线。Metro 保留稳定逻辑模块键，目录调整不能改变已发布 vendor 的编号。

动态功能任务必须使用 npm run publish 发布，不另写上传流程。先确保当前分支包含线上 source.commit；缺少提交时获取本仓库对应历史并按任务要求处理冲突，不覆盖他人改动。不得使用 --force 绕过基线；提交和 PR 按任务要求交付，不自行强推或合并 PR。

App 发起的 Jules 功能任务一次只进行一份心愿。完成代码后先提交所有源码改动，再运行 npm run publish，确保清单 source.commit 对应最终 PR 的 head，source.dirty 为 false；发布后不要再修改或提交源码，否则必须从最终提交重新发布。发布自动生成的 apps/mobile/src/shell/build-identity.json 不提交、不手工维护，它记录当前运行代码的版本标记；不得移除或绕过工坊的版本确认逻辑。

按现有流程创建 PR，但不要合入 main、强推或自行开启下一次任务。会话完成后用户先加载和体验最新包，再在工坊点击确认收下，由服务端核对运行版本和 PR 提交后合入 main；只有确认合入后才能开始下一次制作。调用 prompt 只传用户需求，固定项目要求以本文件和 README.md 为准。最后用中文说明实现内容、发布结果及剩余限制。

用户明确要求构建 DEX 插件时，环境还需 JAVA_HOME 和 ANDROID_HOME 或 ANDROID_SDK_ROOT。

云端发布仅使用维护者注入的 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY 和 BUNDLE_CATALOG_TOKEN。不输出凭证、不获取管理权限、不运行 Wrangler 管理账户登录或直接写 KV；本机 Wrangler 回退是本地维护者流程。凭证缺失或权限不足时保留代码并报告阻塞，不绕过限制。仅命令和线上写入实际成功时报告发布成功。
