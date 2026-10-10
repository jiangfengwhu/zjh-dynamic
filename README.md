# zjh-dynamic

维护 @zijinhua/app-sdk、RN 宿主、运行时适配、加载器和打包发布工具。应用源码与模板在 [zjh-plugin](https://github.com/jiangfengwhu/zjh-plugin)，不在本仓库新增应用业务。宿主从本机目录及已保存的安装清单恢复作品登记，不生成内置应用目录；Jolly 页面属于宿主。

| 目录 | 职责 |
| --- | --- |
| packages/app-sdk | SDK 公共 API、平台契约与共享库清单 |
| packages/ui、packages/platform | SDK 的宿主 UI 与原生能力适配 |
| apps/mobile | RN 宿主与应用加载 |
| tools/applications、tools/release、scripts | SDK 构建、应用打包与宿主发布 |

使用 Node.js >=22.11.0，安装依赖：

```sh
npm ci
npm ci --prefix apps/mobile
```

| 命令 | 用途 |
| --- | --- |
| npm run build:sdk | 构建 SDK 的 dist |
| npm run pack:sdk | 构建 SDK，并在 dist 生成 npm tarball |
| npm run publish:sdk | 构建 SDK 并直接发布到 npm latest；须先发布实现相同 SDK 版本的宿主，原生变化还需配套 APK |
| npm run publish | 构建并发布宿主动态包，不发布应用 |
| npm run release:official -- <appId> <releaseId> | 将指定官方应用版本公开，源码须属于 zjh-plugin/origin/main |

SDK 通过 npm 公共包 `@zijinhua/app-sdk` 分发。SDK 版本只维护在 `packages/app-sdk/package.json`，宿主清单与应用构建都读取实际包版本，不维护独立的最低平台版本。发布 SDK 代码、公共类型或指引变更时，更新包版本并运行 `npm run pack:sdk`；先发布实现该 SDK 版本的宿主动态包，原生能力变化再配套 APK，然后执行 `npm publish ./dist/zijinhua-app-sdk-<版本>.tgz --access public --tag latest` 发布到 latest。云端制作安装 npm latest；手机运行时用实际加载的宿主 SDK 版本判断应用是否可运行。需回退时调整 npm dist-tag，不覆盖已发布版本。npm 包只包含 dist 和 README。

应用构建校验 SDK 管理的依赖与其平台契约一致；应用发布校验授权、候选基线及线上宿主 SDK 兼容性。宿主发布另行校验 RN/Hermes ABI 与共享依赖是否匹配目标 APK。

云端应用 Agent 的操作流程只维护在 plugin AGENTS，开发规则只维护在 [SDK 指引](packages/app-sdk/README.md)。指引、公共类型与[共享库清单](packages/app-sdk/libraries.md)随锁定的 SDK 分发，Agent 直接读取 node_modules 中的文件，无需访问 dynamic 仓库。

维护规则见 [AGENTS.md](AGENTS.md)，宿主视觉与交互原则见 [DESIGN.md](DESIGN.md)。纯文档修改不发布宿主动态包。

作品下载由 applicationDownloads 统一去重和排队，总计最多 3 个任务，后台预热及更新最多使用 2 个名额；当前页下载优先。跨应用更新同时入队，成功项逐项暂存，失败项可重试；提交前重新检查账号、卸载状态和版本。清单序列化按对象复用，未变化的元数据不重复写入；catalog 按存储内容缓存解析，并向调用方返回独立副本。原生准备任务限制 90 秒，JS 等待 100 秒后请求原生取消，收到原生结束回调才释放调度名额。作品翻页结束后，可见页执行只等待尚未结束的转场，后台执行仍等待 idle；其他下载完成不取消当前执行。七页体验缓存和串行 JS 执行保持不变。

宿主全局更新提示只包含宿主动态层与 APK。已安装公开应用的新版独立静默下载，准备结果与当前安装/制作选择隔离；下载完成不替换正在运行的页面，下次从常用、链接或应用入口打开时，仅替换该应用。并发安装、卸载或账号变更优先，准备结果不得覆盖后续选择；下载失败保留当前版本，下一次检查重试。

AI 的消息、多模态校验和请求体组装在 RN 层维护；原生只读取既有引擎密钥、发送受限路径的请求，并处理流式读取、取消、超时和响应大小限制。新增请求参数通过 RN 组装后的 body 传入，不在 Kotlin 重复枚举附件类型。现有文本 SSE 解码继续在原生执行，并按约 40ms 合并增量通知 RN；新响应协议仍需评估原生解码器支持。

宿主使用 vendor 与 app 两层：宿主页面、主题、基础控件及 SDK 实现都属于 app。vendor 只包含第三方模块和最小启动桥接，不引用宿主 UI；打包器检查边界，第三方模块编号保持稳定。页面与主题修改不触发 vendor 重建；第三方依赖、补丁或启动桥接变化才重建 vendor。

应用模块按已分配的模块范围交给独立容器，共享依赖仍由宿主提供。更新、失败回退和卸载只替换目标应用的模块、入口和页面，保留其他应用、导航及持久化数据；只有宿主包或原生运行时更新重载 ReactHost。应用可选的卸载回调及资源清理规则见 SDK README；旧回调仍引用旧模块容器，宿主不接管应用自行创建的全部资源。

作品兼容规则：应用与宿主 SDK 大版本必须一致，宿主完整 SDK 版本不得低于应用实际使用的 SDK 版本。同大版本的新版宿主必须保留旧应用接口、行为和共享依赖入口。应用清单只记录 `sdk`，不接受 `requires` 或独立的最低平台版本。SDK、vendor 或原生变更使旧作品包无法正常运行时必须升 SDK 大版本；纯 JS API 变更发布宿主动态包，原生能力或依赖变更才配套 APK。SDK 大版本不与 APK 契约的大版本绑定；应用清单不按 ABI 或第三方库精确版本拒绝旧包。APK/宿主底层运行时与 vendor 配对检查继续保留，客户端下载文件仅检查状态及长度，哈希用于缓存与版本定位；维护者构建和发布工具仍核对产物哈希。宿主与作品发布器复用 `packages/app-sdk/src/compatibility.ts` 的判断。
