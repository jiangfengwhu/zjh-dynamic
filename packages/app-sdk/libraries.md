# SDK 共享库

公共共享入口与固定版本如下，以已安装 SDK 的 dist/platform.json 为准。开发规则见该 SDK 包根目录的 README.md。

按功能选择即可，不需要同时使用同类库：

- 图片：普通展示用 React Native `Image`；Nitro Image 支持解码、缩放与编码，Nitro Web Image 提供网络加载、缓存与请求优先级。
- Markdown：Enriched Markdown 提供原生渲染与流式展示。
- 列表：普通列表用 `FlatList`，大量内容可用 FlashList；PagerView 提供分页手势，导航 tab 负责路由。
- 绘图：SVG 适合矢量内容，Skia 适合画布；图表库提供现成图表。
- 选择器：普通选项使用原生控件；日期时间、照片裁剪是独立能力，文件导入使用 SDK。
- UI：SDK 提供可选的皮肤与基础控件；成熟专业库按需直接使用。

| 标准 import 入口                         | 固定版本 |
| ---------------------------------------- | -------- |
| `@react-native-community/blur`           | 4.4.1    |
| `@react-native-community/datetimepicker` | 9.2.1    |
| `@react-native-community/netinfo`        | 12.0.1   |
| `@react-navigation/material-top-tabs`    | 7.7.2    |
| `@react-navigation/native`               | 7.4.1    |
| `@react-navigation/native-stack`         | 7.19.2   |
| `@shopify/flash-list`                    | 2.3.2    |
| `@shopify/react-native-skia`             | 2.13.0   |
| `date-fns`                               | 4.4.0    |
| `lottie-react-native`                    | 7.5.0    |
| `lucide-react-native`                    | 1.48.0   |
| `react`                                  | 19.2.3   |
| `react-error-boundary`                   | 6.1.6    |
| `react-native`                           | 0.87.1   |
| `react-native-enriched-markdown`         | 1.1.0    |
| `react-native-calendars`                 | 1.1314.0 |
| `react-native-gesture-handler`           | 3.3.0    |
| `react-native-gifted-charts`             | 1.4.78   |
| `react-native-image-crop-picker`         | 0.52.0   |
| `react-native-keyboard-controller`       | 1.22.5   |
| `react-native-audio-api`                 | 0.13.6   |
| `react-native-vision-camera-barcode-scanner` | 5.2.3 |
| `react-native-nitro-image`               | 0.15.2   |
| `react-native-nitro-web-image`           | 0.15.2   |
| `react-native-pager-view`                | 9.0.5    |
| `react-native-pdf`                       | 7.0.5    |
| `react-native-qrcode-svg`                | 6.3.26   |
| `react-native-reanimated`                | 4.7.0    |
| `react-native-safe-area-context`         | 5.10.0   |
| `react-native-svg`                       | 15.15.5  |
| `react-native-video`                     | 6.19.3   |
| `react-native-view-shot`                 | 6.0.1    |
| `react-native-vision-camera`             | 5.2.3    |
| `react-native-webview`                   | 14.0.1   |
| `react-native-worklets`                  | 0.13.0   |
| `zod`                                    | 4.6.5    |
| `react/jsx-runtime`                      | 19.2.3   |
| `react/jsx-dev-runtime`                  | 19.2.3   |
| `react-hook-form` | 7.89.0 |
| `@tanstack/react-query` | 5.104.1 |
