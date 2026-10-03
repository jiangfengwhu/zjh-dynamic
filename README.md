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
| npm run publish:sdk | 构建并发布至 npm registry，需要发布权限 |
| npm run publish | 构建并发布宿主动态包，不发布应用 |
| npm run release:official -- <appId> <releaseId> | 将指定官方应用版本公开，源码须属于 zjh-plugin/origin/main |


应用接入与候选发布见 [SDK 使用说明](packages/app-sdk/README.md)，可用共享依赖见 [共享库清单](packages/app-sdk/libraries.md)。SDK npm 版本用于工具分发，platform.json.sdk 表示所需宿主 API 版本，两者不要求相等。npm 包只包含 dist 和 README。
