# 云端应用 Agent SDK 指引

本文供云端应用 Agent 开发应用使用；参数以已安装 SDK 的公共类型为准，下表按功能查阅。

入口 `src/index.ts` 默认导出 `defineApp({ main: () => require("./app").default })`。API 从 `@zijinhua/app-sdk` 导入，UI 从其 `/ui` 导入；宿主能力通过 `getAppContext()` 使用。

共享库直接导入，入口与版本查安装包 `dist/libraries.md`；不引用私有路径，不重复安装共享库或使用 overrides。额外纯 JS 依赖写应用 `package.json`，根目录 `npm install` 更新锁文件。不引入 APK 未提供的原生能力。

| 功能 | 使用规则 |
| --- | --- |
| 外观 | 默认继承用户皮肤；从 `/ui` 使用 `Text`、`Icon`、`Button`、`Input`、`Field`、`Surface`、`Dialog`、`ConfirmDialog`、`EmptyState`、`Loading`、`Skeleton`。自绘区域用 `useTheme().colors` 的颜色、typography、spacing、radius、components、motion，不硬编码整页字体和配色。需要独立品牌时用局部 `ThemeProvider skin="soft" mode="light"`，仅影响子树；不改全局 Text 或 TextInput。成熟功能直接使用共享库。 |
| 页面 | 普通页面用 `Screen`、`ScreenBar`；自定义底栏用 `View` 和安全区库。导航栏已透明：贴底背景延伸至屏幕下沿，内容只加一次底部 inset；悬浮栏外侧与导航区用页面背景。不要重复安全区或隐藏系统栏。宿主统一避让键盘，不再套 KeyboardAvoidingView；长表单用 `KeyboardAwareScrollView`。宿主已提供手势、安全区、键盘、BottomSheet、Toast 容器；提示用 `app.toast`，独立导航用 `NavigationIndependentTree`。权限由用户操作触发。 |
| 资源与存储 | 资源放 `assets/`，用 `app.assets.uri(name)`，不用 require 图片。文件与存储用 AppContext；文件路径相对应用目录，下载仅 HTTPS，不读取宿主凭据。 |
| 图片与正文 | 使用 `MediaPicker`、`AppImage`、`RichMarkdown`。选图取消 `E_PICKER_CANCELLED` 不报错；临时文件上传或复制后 `cleanSingle`，不作永久地址、不删相册原件。Markdown 流式传 `markdown/streaming`，自定义链接用 `onLinkPress`。 |
| 动态分享 | 用户点击才调用 `feed.share({ body, html, requestId })`，需先编辑用 `feed.compose`。body ≤2000 字、html ≤32 KB，至少一项；HTML 使用基础文本、a/img 和简单内联样式，不含脚本、事件属性、iframe、外部字体或样式表。媒体用稳定公开 HTTPS 地址；应用链接用 `zijinhua://app/<appId>`。失败重试复用 requestId，新操作换 ID（8–100 位字母、数字或短横线）。 |
| 应用信息 | `application.json` 填 title（≤60 字）、summary（≤300 字）、mark、accent、version、releaseNotes，更新日志写真实改动。图标用 `defineApp.avatar` 并遵守 `AppAvatarProps`；未加载时显示 mark/accent。分类和截图由作者上架时选择。 |
| AI | `app.ai` 提供 `listProviders`、`complete`、`openSettings`；仅文本、非流式，不支持图片或工具调用。密钥不向应用暴露；失败保留输入，不自动重试。 |
