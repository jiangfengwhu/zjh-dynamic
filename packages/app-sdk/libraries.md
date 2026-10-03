# SDK 共享库与能力

宿主动态 HTML 渲染内部使用 `@native-html/render` 1.0.3，SDK 固定其依赖版本。它不是应用公共共享入口；应用通过 `getAppContext().feed.share/compose` 提交 HTML，使用规则见 SDK README。

安装 @zijinhua/app-sdk 即获得固定版本依赖、类型和打包工具。不需要在应用或插件根目录再次安装第三方 RN 库。仅允许下表的标准入口，禁止引用包内部文件；子入口必须先加入平台契约。新增原生依赖需要平台协调发布 APK。

| 标准 import 入口                         | 固定版本 |
| ---------------------------------------- | -------- |
| `@d11/react-native-fast-image`           | 8.13.0   |
| `@gorhom/bottom-sheet`                   | 5.2.14   |
| `@react-native-clipboard/clipboard`      | 1.16.3   |
| `@react-native-community/blur`           | 4.4.1    |
| `@react-native-community/datetimepicker` | 9.2.1    |
| `@react-native-community/netinfo`        | 12.0.1   |
| `@react-native-community/slider`         | 5.2.1    |
| `@react-native-documents/picker`         | 12.0.2   |
| `@react-native-picker/picker`            | 2.11.4   |
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
| `react-native-haptic-feedback`           | 3.0.0    |
| `react-native-image-crop-picker`         | 0.52.0   |
| `react-native-keyboard-controller`       | 1.22.5   |
| `react-native-linear-gradient`           | 2.8.3    |
| `react-native-markdown-display`          | 7.0.2    |
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

## SDK 能力

新业务图片、选图和 Markdown 优先使用 `@zijinhua/app-sdk/ui` 的 `AppImage`、`MediaPicker`、`RichMarkdown`，不要将具体库散落在业务页面。宿主默认图片走 Nitro Image，网络加载由 Nitro Web Image 提供；请求头、GIF/WebP 动画、加载回调等使用原生 Image 保持行为。选图继续使用经 APK 验证的 crop-picker 0.52，通过统一入口输出经过尺寸约束和 JPEG 编码的临时文件。Baronha 2.2.5 因 Nitro 0.37 生成代码不兼容及裁剪原生类冲突，本轮未采用。

`@d11/react-native-fast-image`、`react-native-linear-gradient`、`react-native-markdown-display` 和 `@react-native-community/blur` 保留已有版本与公共键，仅供已发布应用兼容，不再用于新增业务。Blur 暂无覆盖原生视图实时背景的等价替代，不能用 Skia BackdropBlur 假装兼容。RN 0.87 的普通渐变直接使用 View 的 `backgroundImage`。旧 Markdown 保留可校验的解析器补丁作为兼容入口。

```tsx
import { getAppContext } from "@zijinhua/app-sdk";
import { FlashList } from "@shopify/flash-list";
import Clipboard from "@react-native-clipboard/clipboard";
import HapticFeedback from "react-native-haptic-feedback";

const app = getAppContext();
app.storage.set("draft", "hello");
app.storage.remove("draft");
await app.secureStorage.set("token", "application-token");
await app.files.writeText("notes/today.txt", "hello");
await app.files.download("https://example.com/image.jpg", "images/cover.jpg");
app.toast.show("保存成功", "success");
app.clipboard.set("hello");
app.haptics.trigger("notificationSuccess");
```

MMKV、Keychain、BlobUtil、Toast 通过上述能力使用，以应用 ID 为存储及文件命名空间；这些原始包不作为插件公共入口。不要读取宿主账号凭证。共享 JS 运行时并不是恶意代码安全沙箱。文件只接受应用目录内相对路径，下载只接受 HTTPS。files.list 返回应用根目录名称，files.uri 返回本地 file URI。

宿主已挂载 GestureHandlerRootView、SafeAreaProvider、KeyboardProvider、BottomSheetModalProvider 和唯一的 Toast。插件不要重复挂载全局 Toast；使用 app.toast.show。应用内部导航使用 NavigationIndependentTree 包裹自己的 NavigationContainer，不依赖宿主路由。相机、文件选择等权限由对应库按需请求；申请权限必须由明确的用户操作触发。Screens、NitroModules、get-random-values 是宿主运行支撑依赖，插件通过上层库使用。

SDK 的 npm 版本用于分发；platform.json.sdk 是运行时最低 API 版本。发布清单只记录实际用到的共享库版本。依赖或原生 ABI 不兼容时加载器拒绝包，不会悄悄回退到 vendor 内部模块。
