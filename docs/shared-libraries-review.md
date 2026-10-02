# RN 共享依赖盘点与开放建议

状态：待确定清单。2026-10-02 核对宿主、APK 的 package.json/package-lock.json、SDK platform.json、业务源码引用与库间依赖；本次不增删依赖或修改公共契约。

## 结论

宿主和 APK 各有 47 个直接运行依赖，实际锁定版本全部一致。47 包含 React/RN、纯 JS 工具和原生支撑库，并非 47 个原生功能库。当前公共契约有 11 个入口，对应 9 个包，其中第三方 RN 包为 7 个。

建议清理 AsyncStorage 和 Image Picker 两个重复能力包，保留另外 45 个，作为创作应用的工具箱。已有库基本覆盖第一版需求。建议补充 Clipboard 与 Haptic Feedback，替代剪贴板手写实现、补齐语义触感；地图、数据库、支付、音频处理等根据实际作品需求再增加。

“无业务直接引用”不等于可删除：vendor 工具会把直接运行依赖都打进去；支撑依赖和启动副作用也有用途。预装不等于公开、不等于已在真机验证全部 API。当前盘点只覆盖本地宿主、Jolly main 与工具入口，不保证所有云端应用分支都未引用某个包；清理前需盘点已发布包及分支依赖。

## 完整清单

“直接开放”表示加入 SDK shared 标准包入口，SDK 精确安装，插件引用宿主实现；“封装开放”表示公开应用能力，并保留底层包在宿主内部；“支撑”表示由公开功能间接使用，不作为插件常规入口。

| 包 | 锁定版本 | 当前用途/关系 | 建议 |
| --- | --- | --- | --- |
| react | 19.2.3 | 所有页面 | 保留，已开放 |
| react-native | 0.87.1 | RN 基础组件 | 保留，已开放 |
| react-native-svg | 15.15.5 | 平台图标；图表、二维码依赖 | 保留，已开放 |
| react-native-markdown-display | 7.0.2 | 动态、流式文字；平台固定 tarball | 保留，已开放 |
| react-native-reanimated | 4.7.0 | 宿主/Jolly 动画 | 保留，已开放 |
| react-native-worklets | 0.13.0 | 动画、Skia 支撑 | 保留，已开放；说明允许的公共入口 |
| react-native-linear-gradient | 2.8.3 | Surface、头像；图表依赖 | 保留，已开放 |
| react-native-safe-area-context | 5.10.0 | 宿主/UI；导航依赖 | 保留，已开放；优先复用宿主 Provider |
| react-native-video | 6.19.3 | Jolly 伙伴视频 | 保留，已开放 |
| @gorhom/bottom-sheet | 5.2.14 | 预装；依赖手势与动画 | 保留，直接开放；规定 Provider 挂载方式 |
| @shopify/flash-list | 2.3.2 | 预装；长列表 | 保留，直接开放 |
| @shopify/react-native-skia | 2.13.0 | 预装；画布、绘图 | 保留，直接开放；作为重型可选能力 |
| lottie-react-native | 7.5.0 | 预装；矢量动画 | 保留，直接开放 |
| lucide-react-native | 1.48.0 | 预装；应用图标 | 保留，直接开放；平台图标无需同时重做 |
| @react-native-community/blur | 4.4.1 | 预装；模糊背景 | 保留，直接开放 |
| @react-native-community/datetimepicker | 9.2.1 | 预装；原生日期/时间选择 | 保留，直接开放 |
| @react-native-community/slider | 5.2.1 | 预装；原生滑杆 | 保留，直接开放 |
| @react-native-picker/picker | 2.11.4 | 预装；原生选择器 | 保留，直接开放 |
| react-native-calendars | 1.1314.0 | 预装；日历 | 保留，直接开放 |
| react-native-gifted-charts | 1.4.78 | 预装；SVG/渐变图表 | 保留，直接开放；与 Skia 面向不同使用难度 |
| react-native-qrcode-svg | 6.3.26 | 预装；二维码生成 | 保留，直接开放 |
| react-native-toast-message | 2.5.2 | 账号页提示 | 保留；SDK 统一 toast 入口，避免各插件争用全局实例 |
| react-native-keyboard-controller | 1.22.5 | 预装；键盘交互 | 保留，直接开放；统一根 Provider |
| react-native-gesture-handler | 3.3.0 | 动态下拉；Bottom Sheet 依赖 | 保留，直接开放；复用宿主根视图 |
| @d11/react-native-fast-image | 8.13.0 | 预装；网络图片加载/缓存 | 保留，直接开放 |
| react-native-nitro-image | 0.15.2 | Vision Camera 依赖；内存图片操作 | 保留，直接开放；不能当作现成网络图片缓存替代品 |
| react-native-image-crop-picker | 0.52.0 | 头像选择、裁剪、JPEG 压缩 | 保留，直接开放；视频选择关闭 cropping |
| react-native-image-picker | 8.2.1 | 未发现业务引用 | 建议清理；基础媒体选择由 Crop Picker 统一 |
| react-native-vision-camera | 5.2.3 | 预装；相机，依赖 Nitro | 保留，直接开放；声明权限与生命周期要求 |
| react-native-view-shot | 6.0.1 | 预装；视图截图 | 保留，直接开放 |
| @react-native-documents/picker | 12.0.2 | 预装；系统文件选择 | 保留，直接开放；文件路径操作配合 SDK |
| react-native-pdf | 7.0.5 | 预装；PDF 阅读，依赖 Blob Util | 保留，直接开放 |
| react-native-webview | 14.0.1 | 预装；网页嵌入 | 保留，直接开放 |
| @react-native-community/netinfo | 12.0.1 | 预装；网络状态 | 保留，直接开放；全局配置由宿主管理 |
| react-native-blob-util | 0.25.1 | 头像上传；PDF 依赖 | 保留，SDK 封装文件/下载能力；避免跨应用目录操作 |
| react-native-mmkv | 4.3.2 | 宿主状态和账号缓存 | 保留，SDK storage 按应用封装；补充删除等常用操作 |
| @react-native-async-storage/async-storage | 3.1.1 | 未发现业务直接引用；当前存储用 MMKV | 建议清理；插件统一 SDK storage |
| react-native-keychain | 10.0.0 | 平台登录凭证 | 保留，封装按应用命名的 secureStorage；不开放平台凭证接口 |
| @react-navigation/native | 7.4.1 | 宿主导航 | 保留，可直接开放应用内部导航；宿主路由仍通过 SDK |
| @react-navigation/native-stack | 7.19.2 | 宿主原生栈 | 保留，可直接开放应用内部导航 |
| @react-navigation/material-top-tabs | 7.7.2 | 宿主顶层 Tab | 保留，可直接开放应用内部 Tab |
| react-native-pager-view | 9.0.5 | Material Top Tabs 依赖 | 保留，直接开放应用内部分页 |
| react-native-screens | 4.28.0 | Native Stack 依赖，Activity 原生集成 | 保留作导航支撑；全局开关由宿主管理 |
| react-native-nitro-modules | 0.37.1 | MMKV、Nitro Image、Vision Camera 支撑 | 保留作运行时支撑；不开放任意原生模块查找 |
| react-native-get-random-values | 2.0.0 | vendor-entry 启动 polyfill、earlyPackages | 保留作启动支撑，不因无业务 import 删除 |
| date-fns | 4.4.0 | 预装纯 JS 日期工具 | 保留，可作为共享 JS 工具开放 |
| zod | 4.6.5 | 预装纯 JS 数据校验 | 保留，可作为共享 JS 工具开放 |
| react-error-boundary | 6.1.6 | 预装纯 JS 错误兜底组件 | 保留，可作为共享 JS 工具开放 |

## 建议补充

| 候选 | 用途 | 优先级/处理 |
| --- | --- | --- |
| @react-native-clipboard/clipboard | 复制/粘贴 | 优先；替换 ShellPhone 的剪贴板手写实现，保留 SDK 外观接口 |
| react-native-haptic-feedback | success/error/selection 等语义触感 | 优先；补充 SDK haptics，普通 vibrate 继续兼容 |
| react-native-share | 更复杂的分享目标/多文件分享 | 暂不增加；当前 ShellCapabilities 已支持文本和单文件分享 |
| react-hook-form + @hookform/resolvers | 应用表单与 zod 集成 | 非原生、按应用需要安装；暂不增加 APK 依赖 |
| 地图/定位、SQLite、音频录制/处理、支付 | 特定作品能力 | 按产品需求引入，不预装完整业务栈 |

新增原生库先确认 RN 0.87.1/New Architecture 兼容版本，再锁定实际安装版本；本次未宣称它们已在当前 APK 验证。

## 全部分享的实施顺序

1. 确定本清单；补充云端已发布应用/分支引用盘点，再删除两个候选包。依赖声明全部精确锁定，宿主、APK 与 SDK 保持一致。
2. 每个保留的应用功能均对插件提供标准库入口或 SDK 能力入口；只有运行时支撑与平台内部凭证管理不提供原始入口。不是把任意 node_modules 深层路径都放开。
3. 共享组件/工具更新 platform.json、宿主模块注册与 SDK dependencies/类型。支持新增库的公开子入口使用显式清单，按应用实际使用的共享版本校验。
4. 对 Toast、键盘、Bottom Sheet、Safe Area 和应用内导航记录 Provider 规则与全局配置边界，避免多插件各自操作宿主根状态。同进程 JS 不是安全沙箱，命名空间封装只提供使用约束，不能宣传为恶意代码隔离。
5. SDK 包附带清单、标准 import 示例、权限/生命周期说明和 AI Coding 快速指南，让 Agent 安装 SDK 后即可发现全部能力。
6. 清理/新增原生依赖需要新 APK；协调 runtime/server、宿主、SDK、plugin 锁文件和官方应用发布。无需对无关旧应用强制重发，但使用被移除库的版本必须先处理。

## 资料

- [FlashList v2](https://github.com/Shopify/flash-list)：面向 RN New Architecture。
- [Image Crop Picker](https://github.com/ivpusic/react-native-image-crop-picker)：图片、视频选择与裁剪；视频选择不要开启 cropping。
- [Nitro Image](https://github.com/mrousavy/react-native-nitro-image)：内存图片操作；网络加载另需 Web Image loader，保留 FastImage 不视为简单重复。
- [Clipboard](https://github.com/react-native-clipboard/clipboard)：跨平台剪贴板。
- [Haptic Feedback](https://github.com/mkuczera/react-native-haptic-feedback)：语义触感与丰富模式。
