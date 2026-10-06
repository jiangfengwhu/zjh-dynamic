# 云端应用 Agent SDK 指引

本文供云端应用 Agent 开发应用使用；参数以已安装 SDK 的公共类型为准，下表按功能查阅。

入口 `src/index.ts` 默认导出 `defineApp({ main: () => require("./app").default })`。API 从 `@zijinhua/app-sdk` 导入，UI 从其 `/ui` 导入；宿主能力通过 `const app = getAppContext()` 使用。

共享库直接导入，入口与版本查安装包 `dist/libraries.md`；不引用私有路径，不重复安装共享库或使用 overrides。额外纯 JS 依赖写应用 `package.json`，根目录 `npm install` 更新锁文件。不引入 APK 未提供的原生能力。

| 功能 | 使用规则 |
| --- | --- |
| 外观 | 布局、顶栏、交互和组件自由设计，直接使用 React Native 与共享库；`/ui` 的基础组件和媒体适配均可选。默认继承用户皮肤，自绘样式用 `useTheme().colors` 的语义令牌；品牌区域可用局部 `ThemeProvider`。不修改全局 Text 或 TextInput。 |
| Tamagui | 从 `tamagui` 直接导入组件，可用 `styled` 自由组合；宿主已配置主题、字体、动画和 Portal，不再创建配置或 Provider、不加编译插件。颜色用 `$background`、`$surface`、`$color`、`$muted`、`$accent`、`$onAccent`，字体用 `$body`、`$heading`、`$mono`；强调区可用 `<Theme name="accent">`。皮肤圆角使用 SDK `useTheme().colors.components` 的 controlRadius / dialogRadius 数值。尺寸令牌 `$1`–`$10`、默认 `$true`，动画 `fast` / `medium` / `slow`。 |
| 页面 | 需要独立路由时可使用导航库，退出应用用 `app.navigation.back()`。安全区由布局处理一次；系统栏已透明，背景铺到屏幕边缘，底部内容避让 inset。宿主应用页面已避让键盘，独立原生 Modal 需自行处理；长表单可用 `KeyboardAwareScrollView`。宿主已提供手势、安全区、键盘、BottomSheet、Toast 容器，独立导航用 `NavigationIndependentTree`。权限由用户操作触发。 |
| 资源与存储 | 资源放 `assets/`，用 `app.assets.uri(name)`，不用 require 图片。默认数据保存在本机、跨账号共用；需账号隔离用 `app.scope("account")`，设备共享用 `app.scope("device")`，两者均提供 storage、secureStorage、files。账号作用域随登录切换，游客独立；订阅自动更新，异步操作遇到账号切换失败，勿应用旧结果。文件路径相对应用目录、不能含 `..`；下载仅 HTTPS。 |
| 导入导出与分享 | 用户点击后调用 `files.importFile(path, { mime })` 选择并复制文件；`files.exportFile(path, { name, mime })` 打开系统另存为；`files.share(path, { mime })` 分享文件，`app.share({ text })` 分享文字。取消返回 `code: "CANCELLED"`，不提示失败；检查 `ok`。系统分享不发布动态。 |
| 提醒 | 用户开启提醒时调用 `app.phone.requestNotifications()` 检查 granted。`schedule(id, title, body, atMs)` 创建或替换提醒，`cancelSchedule(id)` 取消提醒及已显示通知，`schedules()` 查询当前应用待触发提醒。ID 在应用内唯一，使用字母、数字、点、短横线或下划线；含应用前缀总长 ≤80。检查 `ok`；系统权限或省电策略可能影响送达时间。 |
| 图片与正文 | 渲染器按需选择，见 `dist/libraries.md`。`MediaPicker` 提供方向修正、压缩与安全临时文件；取消 `E_PICKER_CANCELLED` 不报错，上传或复制后 `cleanSingle`，不作永久地址、不删相册原件。`RichMarkdown` 提供皮肤字体与流式显示，亦可直接使用 Markdown 库自行配置。 |
| 动态分享 | 用户点击才调用 `app.feed.share({ body, html, requestId })`，需先编辑用 `app.feed.compose`。body ≤2000 字、html ≤32 KB，至少一项；HTML 支持基础文本、a/img 和内联样式，不含脚本、事件属性、iframe 或外部样式表；样式效果受客户端渲染器支持范围限制，字体跟随用户皮肤。媒体用稳定公开 HTTPS 地址；应用链接用 `zijinhua://app/<appId>`。失败重试复用 requestId，新操作换 ID（8–100 位字母、数字或短横线）。 |
| 应用信息 | `application.json` 填 title（≤60 字）、summary（≤300 字）、mark、accent、version、releaseNotes，更新日志写真实改动。图标用 `defineApp({ main, avatar })` 并遵守 `AppAvatarProps`；未加载时显示 mark/accent。分类和截图由作者上架时选择。 |
| AI | `app.ai.complete(request, { signal })` 返回文本；`app.ai.stream(request, { signal, onText })` 逐步回调累计文本，两者返回相同结果。用 AbortController 取消，离开页面时 abort；取消返回 `code: "CANCELLED"`，部分文本由应用决定保留。仅文本，不支持图片或工具调用。引擎由 `listProviders` 查询、`openSettings` 配置；密钥不暴露。检查 `result.ok`，失败保留输入，不自动重试。 |
