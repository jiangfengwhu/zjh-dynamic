# zjh-dynamic

维护 @zijinhua/app-sdk、RN 宿主、运行时适配、加载器和打包发布工具。应用源码与模板在 [zjh-plugin](https://github.com/jiangfengwhu/zjh-plugin)，不在本仓库新增应用业务。

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

SDK 代码、公共类型或指引变更后，运行 `npm run pack:sdk`，再执行 `npx --no-install tsx scripts/publish-sdk-tarball.ts` 上传 R2；将输出的 SDK_URL 写入 zjh-plugin 的 SDK 依赖，并在该仓库执行 `npm install` 更新锁文件。固定依赖与平台契约保持一致；发布器校验授权、候选基线、RN/Hermes ABI、宿主 API 和共享依赖版本。npm 包只包含 dist 和 README；SDK 包版本与 `platform.json.sdk` 的宿主 API 版本不要求相等。

云端应用 Agent 的操作流程只维护在 plugin AGENTS，开发规则只维护在 [SDK 指引](packages/app-sdk/README.md)。指引、公共类型与[共享库清单](packages/app-sdk/libraries.md)随锁定的 SDK 分发，Agent 直接读取 node_modules 中的文件，无需访问 dynamic 仓库。

维护规则见 [AGENTS.md](AGENTS.md)，宿主视觉与交互约定见 [DESIGN.md](DESIGN.md) 和 [UX-CONTRACT.md](UX-CONTRACT.md)。纯文档修改不发布宿主动态包。
