# 紫金花应用 SDK

## 用户动态分享（宿主 API 2.0）

动态只有用户作者，身份由服务端根据登录账号确定。应用在用户明确点击分享时调用 `feed.share`，不在安装、更新、定时器或状态轮询中自动发布。2.0 删除 `cards` 和旧的 `feed.publish/upsert/remove/recordChange`，不兼容旧应用包，应用须重新构建。

```ts
const { feed } = getAppContext();
// 点击即发布，返回动态 ID；请求期间禁用分享按钮，失败会抛错。
const post = await feed.share({
  body: "我的制作进度",
  html: '<div style="padding:12px;background-color:#e8f8ef;border-radius:12px"><p>语音备忘录</p><p>正在制作 · 60%</p></div>',
  requestId: "optional-unique-operation-id",
});
// 需要先编辑时，显式打开宿主发布页。
await feed.compose({ body: "我的制作进度", html: "<p>正在制作</p>" });
```

body 最多 2000 字，html 最多 32 KB，二者至少填写一项。分享保存完整 HTML 快照，所有用户都由宿主原生渲染，无需安装来源应用。媒体使用稳定的公开 HTTPS 地址，不使用应用本地文件、临时签名地址或运行时模板变量。链接支持 HTTPS 和 `zijinhua://app/<appId>`。

支持 div/p/span/h1-h4、strong/b/em/i/u/s、br/hr、ul/ol/li、blockquote/pre/code、a/img。使用内联 style，支持基础文字、颜色、间距、边框、圆角、尺寸与简单布局；不提供完整浏览器 CSS 语义，不支持样式表、复杂选择器、脚本、事件属性、iframe 和外部字体。服务端清理不支持的内容；HTML 图片必须使用 HTTPS。默认字体沿用宿主像素字体，身份行、菜单和交互栏由宿主提供。

同一失败操作重试复用 requestId（8–100 位字母、数字或短横线），新的分享操作使用新 ID。匿名用户先登录，取消登录则不发布。应用不导入 `@native-html/render`，它是宿主内部实现；应用只提交 HTML 内容。

提供应用 API、公共 UI、宿主能力和独立打包工具，不包含应用业务或宿主源码。Node.js >=22.11.0。

## 接入

SDK 1.4 的媒体与正文入口统一在 `@zijinhua/app-sdk/ui`：

```tsx
import { AppImage, MediaPicker, RichMarkdown } from "@zijinhua/app-sdk/ui";

<AppImage
  source={{ uri: imageUrl }}
  resizeMode="contain"
  style={{ width: 160, height: 240 }}
/>;
<RichMarkdown markdown={body} streaming={receiving} />;
const photos = await MediaPicker.openPicker({
  multiple: true,
  maxFiles: 4,
  compressImageMaxWidth: 1600,
  compressImageMaxHeight: 1600,
  compressImageQuality: 0.8,
});
// 上传或复制到草稿目录后清理临时文件；不删除相册原件。
await Promise.all(photos.map((photo) => MediaPicker.cleanSingle(photo.path)));
```

单选头像传 `cropping: true, cropperCircleOverlay: true, width: 512, height: 512`，返回单个图片；用户取消抛出 `code: E_PICKER_CANCELLED`。临时路径只用于本轮上传／草稿复制，不作永久存储。`RichMarkdown` 默认支持原生选择、中文复制菜单、字体缩放与链接；仅默认打开 HTTP(S)、mailto、tel，应用自定义路由通过 `onLinkPress` 处理。流式更新直接传 `markdown` 和 `streaming`，当前采用原生渐进渲染，不要求 Worklets Bundle Mode。动态页像素字体由配套 APK 注册。新能力需要匹配 1.4 平台契约，旧应用仍可使用既有公共入口。

应用在 zjh-plugin/apps/<id>/，包含 application.json、package.json、src/index.ts 和可选 assets/。所有命令在插件仓库根目录执行；先运行 npm ci，使用仓库锁定的 SDK。发布只接受 origin 为 jiangfengwhu/zjh-plugin 的源码。

- 入口默认导出 defineApp(...)；公共 SDK 入口为 @zijinhua/app-sdk、@zijinhua/app-sdk/ui、@zijinhua/app-sdk/creation。
- platform.json 中公开的共享库入口可直接导入，禁止引用宿主、vendor、共享库内部文件或其他应用源码。
- 插件根 package.json 只声明 SDK；共享依赖版本由 SDK 管理，不重复安装或使用 overrides 改写。
- 应用自身的额外纯 JS 依赖写入 apps/<id>/package.json；版本以 application.json 为准。
- 图片、视频放入 assets/，通过 getAppContext().assets.uri(name) 获取地址，不使用 require 图片。

最小入口 src/index.ts（页面默认导出放在 src/app.tsx）：

```ts
import { defineApp } from "@zijinhua/app-sdk";

export default defineApp({ main: () => require("./app").default });
```

已安装版本的共享库清单和平台契约位于 node_modules/@zijinhua/app-sdk/dist/libraries.md、dist/platform.json，也通过 @zijinhua/app-sdk/libraries.md 和 @zijinhua/app-sdk/platform.json 导出。公共类型随 SDK 提供；[源码清单](https://github.com/jiangfengwhu/zjh-dynamic/blob/main/packages/app-sdk/libraries.md)可能比已安装版本更新。

## 构建与候选发布

### 全屏布局

宿主应用渲染容器铺满整个屏幕，状态栏与导航栏透明且保持系统手势可用。宿主不在应用外层添加 SafeArea 或系统栏 padding；根背景、图片和滚动容器应延伸到屏幕边缘，不预留一条空白状态栏区域。

透明系统栏仍有设备 inset。应用自行安排文字和按钮避让，不应把“容器没有安全区 padding”理解为设备 inset 为零。普通 `View` 根容器使用 `flex: 1` 即可；SDK `Screen` 会自动处理内容安全区，`ScreenBar` 会处理顶部 inset，使用它们时不要再叠加 SafeAreaView、固定状态栏高度或第二层相同的 padding。应用无需设置或隐藏系统栏。

### 随包交付的市场信息

完善 `apps/<id>/application.json` 中的 `title`（应用名，最多 60 字）、`summary`（功能与用途介绍，最多 300 字）、`mark`（未加载应用时的短图标标识）、`accent`（图标底色）、`version` 和可选 `releaseNotes`（本次真实修改的简短更新日志）。构建工具将这些信息保存到版本清单；应用名和介绍自动带入上架表单，更新日志随选定版本显示在作品详情。

为应用制作符合其用途的像素图标，通过 `defineApp({ main, avatar })` 提供头像组件，遵守 `AppAvatarProps` 的尺寸和圆角。需要图片时放在应用 `assets/` 中，按资源 API 引用。未安装／未加载应用时不会执行头像组件，当前市场使用 `mark` 和 `accent` 占位；不要声称图片图标或市场截图会自动上传。市场分类与截图目前仍由作者在上架页选择。候选交付后由作者决定是否公开，不自动上架。

新建应用填写准确的名称、介绍和首版说明，修改应用保留身份与用途、更新版本和本轮日志，不复用上轮说明。交付必须先提交源码与锁文件，再实际执行下方 publish 命令，核实上传与清单写入成功；不能只给出代码或称“已打包”而没有候选版本。

云端制作任务先保存平台签发的本应用、本轮授权，再初始化新应用：

```sh
npx --no-install zjh-app authorize <id> '<grant>'
npx --no-install zjh-app init <id>
```

将占位符替换为任务给定的 appId 与授权。init 使用插件仓库模板并读取服务端分配的模块范围，不自行修改 appId 或 moduleBase；已有应用无需再次 init，但每轮制作仍需有效授权。添加或修改纯 JS 依赖后，在仓库根目录运行 npm install，提交对应 package.json 和根 package-lock.json。

修改完成后提交全部源码，再发布：

```sh
git add <changed-files>
git commit -m "Describe application changes"
npx --no-install zjh-app publish <id>
```

publish 自动构建；只需构建时使用 npx --no-install zjh-app build <id>。--no-install 确保使用已安装 SDK 的 CLI，不临时下载同名包。构建产物位于 dist/applications/<id>/。

- 发布记录源码仓库、提交与包哈希，要求整个仓库工作区干净，包括根锁文件。
- 候选发布校验本轮授权和原子基线；基线冲突时确认最新候选与本轮改动后重新发布，不绕过检查。
- 候选发布不要求合入 main，也不检查提交祖先。后续修改继续在应用分支迭代。
- publish 仅上传候选，不自动更新公开版本。公开版本由作者选择；应用 Agent 不调用官方公开发布接口。
- 授权保存在 Git 元数据目录，不输出或提交。云端不使用共享 R2、Wrangler 或宿主发布凭证；官方维护者可配置 OFFICIAL_PUBLISH_TOKEN。

## 兼容与宿主能力

发布和加载校验 RN/Hermes ABI、宿主 API 与实际引用的共享依赖。SDK API 要求同主版本且宿主不低于应用需求；共享依赖要求精确版本。新增无关共享库不会使旧包失效；升级所用依赖、ABI 或 API 主版本时需适配。不能修改清单绕过检查。

getAppContext() 提供存储、文件、资源、动态、导航、剪贴板、触感和提示等能力。共享 JS 环境不构成恶意代码沙箱，不读取宿主账号凭证。公共 UI 可选，应用自行绘制页面和动态内容。

AI 使用 getAppContext().ai：listProviders() 获取模型信息，complete({ messages, providerId?, temperature?, maxTokens? }) 请求文本，openSettings() 打开宿主配置页。密钥由原生宿主保存，请求从本机发送至用户配置的服务商；不向应用暴露密钥。失败保留输入并提示，不自动重试；当前不支持流式、图片或工具调用，完整参数和结果见 SDK 类型。

@zijinhua/app-sdk/creation 提供宿主授权给 Jolly 的制作服务，普通应用不能直接获得制作权限。服务按 appId 绑定 session，读取聚合进展和历史，只检查或更新目标应用。缓存用于展示，不代替写操作的实时鉴权。

### 动态内容模板

用户动态、宿主默认动态和应用的 PostFrame 共用同一渲染结构：左侧圆形头像；右侧姓名和时间、内容区、评论／点赞／分享。应用登记的动态组件使用 PostFrame，将自定义 JSX 放入 content；只有姓名行与交互栏之间的内容区支持业务自绘。content 可以包含正文、图片、状态、进度和业务控件，不再重复绘制头像、姓名时间或底部交互栏。传 null 留空，未传时仍使用默认正文；body、children 兼容既有组件。用户动态的菜单、图片预览和请求状态仍由宿主处理。

```tsx
return <PostFrame {...card} content={<MyPostContent post={card.post} />} />;
```
