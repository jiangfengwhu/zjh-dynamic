# 应用 SDK v1 使用说明

平台宿主不再直接打包应用业务。Jolly、记事本和番茄钟各自发布独立 Hermes 包，Jolly 随 APK 默认安装。旧用户应用身份、笔记、番茄钟统计和工坊会话保留，SDK 首次读取时迁移旧存储键。新安装默认只有 Jolly，暂未提供应用市场页面。

## AI Coding 的输入

当前第一版在动态仓库内开发，暂未发布可脱离仓库安装的 npm SDK。AI 获得 AGENTS.md、目标应用目录、SDK 类型、公共模块清单、依赖锁及构建命令；不需要 Android/server 仓库。

- packages/app-sdk/src/index.ts：defineApp、AppDefinition、AppContext 类型。
- packages/app-sdk/src/ui.ts：可选公共 UI，应用可以完全自绘。
- tools/applications/public-modules.json：公共依赖入口与 SDK 版本。
- apps/mobile/package-lock.json：依赖与 Hermes 工具链精确版本。
- /v1/runtime 的 applications 字段：实际发布的平台契约。
- packages/features/notepad 和 pomodoro：可工作示例。

执行 `npm run init:application -- <id>` 创建模板，实现 packages/features/<id>/index.ts 与 app.tsx，填写 application.json；无须编辑宿主注册表。Jolly 的工坊页面位于 Workshop.tsx。

```ts
import { defineApp } from "@zijinhua/app-sdk";
export default defineApp({ main: () => require("./app").default });
```

页面调用 getAppContext() 获取绑定 appId 的存储、动态、导航、资源与手机能力。存储使用 get/set/subscribe，subscribe 返回取消函数。动态 feed.publish/upsert 自动绑定应用，upsert/remove 的 ID 必须以 appId- 开头。通知和定时提醒 ID 自动加应用前缀。navigation.back/open/create 分别返回、打开自身和进入工坊。制作服务仅授权 Jolly。

## 打包与依赖

应用只引用 SDK 和公共模块的顶层入口，不引用 vendor 数字编号或内部文件。React/RN 和已公开原生库来自宿主单例，额外纯 JS 依赖私有打包。构建器拒绝其他应用、宿主源码和未公开的原生依赖。依赖仍使用现有 mobile 清单与锁文件，首版尚未拆成每应用自己的 npm 安装工程。

每个应用有独立模块范围，新应用由初始化脚本分配。线上服务拒绝范围冲突，已有范围不可改变。同一进程只运行每应用一个版本；更新下载后重载 JS，禁止原地替换旧模块。

assets/ 内资源按 SHA-256 打包上传，页面用 ctx.assets.uri("目录/文件名") 配合 Image/Video 的 uri。第一版不支持 require 图片；媒体随应用安装缓存。Jolly 种子包含离线代码与媒体。

engineAbi 包含 RN 与 Hermes 编译器版本；共享依赖仅记录应用实际引用的入口和精确版本；SDK 按同主版本、平台版本不低于需求版本判断。宿主增加无关公开库或兼容 SDK 更新不使已有应用失效。应用引用的共享库升级、RN/Hermes ABI 或 SDK 主版本变化需要适配应用。

## 发布与恢复

提交所有源码后运行 `npm run publish:application -- <id>`。输出 dist/applications/<id>/manifest.json、Hermes 包、资源、模块编号表与源码映射。不可变清单位于 /v1/applications/<id>/releases/<releaseId>，latest 是发布指针。应用 source.commit 绑定发布提交，dirty 必须为 false；应用基线与宿主基线分开检查。构建产物不提交 Git。源码映射当前保存在构建目录，尚未提供线上诊断下载服务。

平台校验兼容性再加载，原生缓存逐个验证哈希与字节数。安装成功后保存当前和上一版本；待激活包在加载中崩溃时，下次启动跳过该次更新；更新后的页面渲染失败时，下次启动退回保存的上一版本。用户数据不因包回滚而清空，但不自动回滚应用已经写入的数据。没有上一版本的坏应用显示错误，需要修复发布。

首版没有通用数据迁移平台，更新不得改变 dataSchemaVersion；维护者需设计迁移后再扩展。订阅和定时器由应用 effect 自行释放，尚未提供 SDK 托管 disposable 生命周期。包共享同一 JS 环境，是工程隔离，不是恶意代码沙箱，只支持平台维护与工坊审核的代码。

当前复用既有云端发布凭证，尚未拆分每应用的发布令牌。市场开放上传、每用户权限、历史兼容版本自动选择、完全独立 AI 工程、应用多实例均留待后续。最新版本不兼容时保留已安装旧版并提示，需要平台与应用升级协调。

维护者首次部署顺序：服务端目录与确认协议 → 新 APK 运行时契约 → 提交并发布独立应用 → 发布宿主 → 下载宿主和 Jolly 种子构建 APK。旧 APK 保留原运行时，不会误载需要新原生加载能力的宿主包。
