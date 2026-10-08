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
| npm run publish | 构建并发布宿主动态包，不发布应用 |
| npm run release:official -- <appId> <releaseId> | 将指定官方应用版本公开，源码须属于 zjh-plugin/origin/main |

SDK 通过 npm 公共包 `@zijinhua/app-sdk` 分发。代码、公共类型或指引变更后，更新包版本并运行 `npm run pack:sdk`；核对 SDK 与线上宿主/APK 契约一致后，执行 `npm publish ./dist/zijinhua-app-sdk-<版本>.tgz --access public --tag latest` 发布到 latest。latest 只指向当前线上平台可用的稳定版本；需回退时调整 npm dist-tag，不覆盖已发布版本。Jules 每轮任务从 npm 读取 latest 的确切版本，并通过任务准备命令安装和锁定，不为更新 SDK 同步 Git main。plugin 模板使用明确版本，更新依赖后执行 `npm install` 更新锁文件。固定依赖与平台契约保持一致；发布器校验授权、候选基线、RN/Hermes ABI、宿主 API 和共享依赖版本。npm 包只包含 dist 和 README；SDK 包版本与 `platform.json.sdk` 的宿主 API 版本不要求相等。

云端应用 Agent 的操作流程只维护在 plugin AGENTS，开发规则只维护在 [SDK 指引](packages/app-sdk/README.md)。指引、公共类型与[共享库清单](packages/app-sdk/libraries.md)随锁定的 SDK 分发，Agent 直接读取 node_modules 中的文件，无需访问 dynamic 仓库。

维护规则见 [AGENTS.md](AGENTS.md)，宿主视觉与交互原则见 [DESIGN.md](DESIGN.md)。纯文档修改不发布宿主动态包。

宿主仍使用 vendor 与 app 两层，app 就是经常更新的 main 界面包：宿主页面、主题、基础控件及 SDK 实现都属于 app。vendor 只包含第三方模块和最小启动桥接，不引用宿主 UI；打包器检查边界，旧 vendor 中误收的宿主模块迁回 app，第三方模块编号保持稳定。页面与主题修改不触发 vendor 重建；第三方依赖、补丁或启动桥接变化才重建 vendor。

平台兼容以 SDK 大版本为边界：同大版本的新版宿主必须保留旧应用接口、行为和共享依赖入口；应用最低 API 版本不得高于实际加载的宿主版本。SDK、vendor 或原生变更使旧包无法正常运行时必须升 SDK 大版本，并配套 APK；应用清单不再按 ABI 或第三方库精确版本拒绝旧包。APK/宿主底层运行时、包哈希与 vendor 配对检查继续保留。宿主与作品发布器复用 `packages/app-sdk/src/compatibility.ts` 的判断。
