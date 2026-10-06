# 云端应用 Agent SDK 指引

本文供云端应用 Agent 开发应用使用；参数以已安装 SDK 的公共类型为准，下表按功能查阅。

入口 `src/index.ts` 默认导出 `defineApp({ main: () => require("./app").default })`。API 从 `@zijinhua/app-sdk` 导入，UI 从其 `/ui` 导入；宿主能力通过 `getAppContext()` 使用。

共享库直接导入，入口与版本查安装包 `dist/libraries.md`；不引用私有路径，不重复安装共享库或使用 overrides。额外纯 JS 依赖写应用 `package.json`，根目录 `npm install` 更新锁文件。不引入 APK 未提供的原生能力。

| 功能 | 使用规则 |
| --- | --- |
| 外观 | 布局、顶栏、交互和组件自由设计，直接使用 React Native 与共享库；`/ui` 的基础组件和媒体适配均可选。默认继承用户皮肤，自绘样式用 `useTheme().colors` 的语义令牌；品牌区域可用局部 `ThemeProvider`。不修改全局 Text 或 TextInput。 |
| 页面 | 用导航库管理应用内路由，退出应用用 `app.navigation.back()`。安全区由布局处理一次；系统栏已透明，背景铺到屏幕边缘，底部内容避让 inset。宿主统一避让键盘，长表单可用 `KeyboardAwareScrollView`。宿主已提供手势、安全区、键盘、BottomSheet、Toast 容器，独立导航用 `NavigationIndependentTree`。权限由用户操作触发。 |
| 资源与存储 | 资源放 `assets/`，用 `app.assets.uri(name)`，不用 require 图片。文件与存储用 AppContext；文件路径相对应用目录，下载仅 HTTPS，不读取宿主凭据。 |
| 图片与正文 | 渲染器按需选择，见 `dist/libraries.md`。`MediaPicker` 提供方向修正、压缩与安全临时文件；取消 `E_PICKER_CANCELLED` 不报错，上传或复制后 `cleanSingle`，不作永久地址、不删相册原件。`RichMarkdown` 提供皮肤字体与流式显示，亦可直接使用 Markdown 库自行配置。 |
| 动态分享 | 用户点击才调用 `feed.share({ body, html, requestId })`，需先编辑用 `feed.compose`。body ≤2000 字、html ≤32 KB，至少一项；HTML 使用基础文本、a/img 和简单内联样式，不含脚本、事件属性、iframe、外部字体或样式表。媒体用稳定公开 HTTPS 地址；应用链接用 `zijinhua://app/<appId>`。失败重试复用 requestId，新操作换 ID（8–100 位字母、数字或短横线）。 |
| 应用信息 | `application.json` 填 title（≤60 字）、summary（≤300 字）、mark、accent、version、releaseNotes，更新日志写真实改动。图标用 `defineApp.avatar` 并遵守 `AppAvatarProps`；未加载时显示 mark/accent。分类和截图由作者上架时选择。 |
| AI | `app.ai` 提供 `listProviders`、`complete`、`openSettings`；仅文本、非流式，不支持图片或工具调用。密钥不向应用暴露；失败保留输入，不自动重试。 |
