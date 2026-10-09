# 云端应用 Agent SDK 指引

本文供云端应用 Agent 开发应用使用；参数以已安装 SDK 的公共类型为准，下表按功能查阅。平台要求 SDK 大版本相同，且宿主 API 版本不低于应用要求；构建工具按所用 SDK 的平台契约记录所需版本，不手动修改平台版本。

入口 `src/index.ts` 默认导出 `defineApp({ main: () => require("./app").default })`。API 从 `@zijinhua/app-sdk` 导入，UI 从其 `/ui` 导入；宿主能力通过 `const app = getAppContext()` 使用。

共享库直接导入，入口与版本查安装包 `dist/libraries.md`；不引用私有路径，不重复安装共享库或使用 overrides。额外纯 JS 依赖写应用 `package.json`，根目录 `npm install` 更新锁文件。不引入 APK 未提供的原生能力。

权限检查与请求统一用 `react-native-permissions`；仅在用户操作后请求，按 `RESULTS` 处理结果，永久拒绝时由用户点击 `openSettings()`。通知用 `app.phone.requestNotifications()`。

| 功能 | 使用规则 |
| --- | --- |
| 外观 | 布局、顶栏和交互自由设计，可选用 `/ui` 的主题、基础控件、图标、空态、骨架和媒体适配。默认继承宿主的明暗主题，自绘样式用 `useTheme().colors` 的语义令牌；局部外观可用 ThemeProvider。不修改全局 Text 或 TextInput。 |
| 页面 | 按独立应用设计页面：首页不放返回按钮，二级页面按需提供应用内返回。需要独立路由时可使用导航库。系统栏采用边缘绘制，宿主不添加应用安全区 padding 或导航区背景，应用自行处理安全区。底栏背景应覆盖底部安全区，仅交互内容避让 inset，避免与系统导航区域出现色差。宿主应用页面已避让键盘，独立原生 Modal 需自行处理；长表单可用 `KeyboardAwareScrollView`。宿主已提供手势、安全区、键盘容器；弹层可用 SDK Dialog、原生 Modal 或 `@gorhom/bottom-sheet`；使用 BottomSheetModal 时在应用内提供 BottomSheetModalProvider，独立导航用 `NavigationIndependentTree`。 |
| 表单与请求 | 简单输入可用本地状态；复杂表单可用 `react-hook-form` 的 Controller，Zod 按需校验。缓存读取可用 `@tanstack/react-query`；宿主已提供按应用和账号隔离的 QueryClient，不再创建 Provider，queryFn 将 signal 传入请求。默认 staleTime 为 60 秒，未使用缓存保留 20 分钟；重新挂载过期查询会保留旧内容并后台刷新，无轮询、自动重试、聚焦或联网刷新。手动更新用 refetch／invalidateQueries。缓存仅在内存中，跨进程保存需使用 storage；宿主在切换账号时取消请求并清理缓存。AI 流式调用可直接使用 SDK。 |
| 反馈与系统能力 | 简单提示用 `app.toast.show`。复制与触觉用 `app.clipboard`、`app.haptics`，不另引入同类库。 |
| 资源与存储 | 资源放 `assets/`，名称相对该目录，如 `assets/logo.webp` 用 `app.assets.uri("logo.webp")`，不用 require 图片。默认数据保存在本机、跨账号共用；需账号隔离用 `app.scope("account")`，设备共享用 `app.scope("device")`，两者均提供 storage、secureStorage、files。账号作用域随登录切换，游客独立；订阅自动更新，异步操作遇到账号切换失败，勿应用旧结果。文件路径相对应用目录、不能含 `..`；下载仅 HTTPS。 |
| 登录与云数据 | `app.auth.getUser()` 同步返回缓存的 `{ id, name, avatarUrl }` 或 null，`subscribe` 监听资料变化；用户操作后可调用 `requireLogin()`，取消返回 null。`app.cloud.private.collection<T>(name)` 保存当前用户的应用数据；`public` 所有登录用户可读，仅创建者可修改、删除。集合自动创建，无需配置。两者均提供 create/get/list/update/remove；数据为 JSON 对象，单条 ≤32 KB。get 不存在返回 null；list 返回 items/nextCursor，默认 20 条、最多 100，游标沿用同一筛选和排序。update 只合并顶层字段；increment(id, { score: 1 }) 在服务端原子累加数值字段，缺失字段按 0 处理；可传 expectedVersion 检测冲突。写入失败重试复用 requestId（一小时内去重）；平台字段在记录外层，业务字段在 data。失败抛出 CloudError，按 code 处理登录过期、冲突、限流等，保留输入。缓存配合 React Query，不轮询、不自动重试写入；离开页面用 signal 取消。 |
| 导入导出与分享 | 先取 `const { files } = app.scope("account")`（设备共享可选 device）。用户点击后调用 `files.importFile("imports/data.csv", { mime: "text/csv" })` 选择并复制文件，第一个参数是应用内目标相对路径。`files.exportFile(path, { name, mime })` 另存已有文件；`files.share(path, { mime })` 分享已有文件，`app.share({ text })` 分享文字。检查返回的 ok；取消返回 `code: "CANCELLED"`，不提示失败。系统分享不发布动态。 |
| 提醒 | 用户开启提醒时调用 `app.phone.requestNotifications()` 检查 granted。`app.phone.schedule(id, title, body, atMs)` 创建或替换提醒，`app.phone.cancelSchedule(id)` 取消提醒及已显示通知，`app.phone.schedules()` 查询当前应用待触发提醒。ID 在应用内唯一，使用字母、数字、点、短横线或下划线；含应用前缀总长 ≤80。检查 ok；系统权限或省电策略可能影响送达时间。 |
| 定位 | 用户操作后用权限库申请 `ACCESS_COARSE_LOCATION`，需要精确位置时同时申请 `ACCESS_FINE_LOCATION`，尊重用户选择的近似位置。`app.phone.location({ accuracy: "coarse" })` 获取一次前台位置，精确定位用 `fine`；默认 coarse，不请求后台定位。成功返回 `{ ok: true, latitude, longitude, accuracy }`，accuracy 单位为米；失败返回 `{ ok: false, code, error }`，code 为 PERMISSION、TIMEOUT 或 UNAVAILABLE。不自动申请权限或轮询。 |
| 图片与正文 | 渲染器按需选择，见 `dist/libraries.md`。`MediaPicker` 提供方向修正、压缩与安全临时文件；取消 `E_PICKER_CANCELLED` 不报错，上传或复制后调用 `MediaPicker.cleanSingle`，不作永久地址、不删相册原件。`RichMarkdown` 提供宿主字体与流式显示，亦可直接使用 Markdown 库自行配置。 |
| 渐变、扫码与录音 | 渐变用 Skia，现有图表库的渐变已接入 Skia。扫码用 `react-native-vision-camera-barcode-scanner`，需 CAMERA 权限，离开页面停止采集。录音用 `react-native-audio-api` 的 AudioRecorder，需 RECORD_AUDIO 权限；启用文件输出后 start，stop 取得文件结果并检查 status，离开页面停止录音。持续保存的录音使用应用自己的文件目录。 |
| 动态分享 | 用户点击才调用 `app.feed.share({ body, html, requestId })`，需先编辑用 `app.feed.compose`。body ≤2000 字、html ≤32 KB，至少一项；HTML 支持基础文本、a/img 和内联样式，不含脚本、事件属性、iframe 或外部样式表；样式效果受客户端渲染器支持范围限制，字体跟随宿主的明暗主题。媒体用稳定公开 HTTPS 地址；应用链接用 `zijinhua://app/<appId>`。失败重试复用 requestId，新操作换 ID（8–100 位字母、数字或短横线）。 |
| 应用信息 | 按应用性质、用途和实际功能填写 `application.json`：`appName`（≤60 字）是简洁应用名，`description`（≤300 字）说明用途，`accent` 是契合主题的 `#RRGGBB`。每次发布必须更新 `version`（如 `1.0.1`）和 `releaseNotes`：用简短中文分行说明本次新增、优化或修复，首次发布说明主要功能；不能留空、沿用上次日志或写成任务过程。保留初始化生成的 `appId`、`moduleBase`；Remix 来源由平台维护，不填写 `originalAppId`、`originalReleaseId`、`originalCommit`，不填写 `mark`、`title`、`summary` 或平台生成字段。图标只需生成 `assets/icon.svg`，发布命令自动上传并登记，不需要 avatar 组件或手填图标字段。SVG 使用正方形 viewBox，主体居中留边，小尺寸清晰；按应用用途设计，避免文字、emoji 和通用占位图标。文件不超过 64 KB，只用静态自包含图形，可用渐变，不嵌入图片、脚本或外部资源。作者可手动上传图标，平台自动缩放压缩，且优先于应用图标。分类和截图由作者上架时选择。 |
| AI | `app.ai.complete(request, { signal })` 与 `app.ai.stream(request, { signal, onText })` 都返回结果对象；成功为 `{ ok: true, text, providerId, model }`，失败为 `{ ok: false, code, error }`，先判断 ok 再读取 text。stream 的 onText 回调累计文本。用 AbortController 取消，离开页面时 abort；取消 code 为 `CANCELLED`，部分文本由应用决定保留。用户消息可选 attachments：图片 { type: "image", url, detail? }，url 为 HTTPS 或 JPEG/PNG/WebP/GIF 的 base64 data URL；音频 { type: "audio", data, format: "wav" | "mp3" }，data 为不带前缀的 base64。纯文本仍用 content 字符串，完整请求最多 16 个附件、附件字符串总计 ≤8 MB；需要所选模型支持对应输入。complete 和 stream 都仍返回文本，不提供生成图片、音频输出或工具调用。引擎由 `app.ai.listProviders()` 查询、`app.ai.openSettings()` 配置；密钥不暴露。失败保留输入，不自动重试。 |

## 云文件与实时协作（SDK 2.2）

云能力随 appId 和宿主登录账号隔离，凭证由宿主保管。使用这些新增接口的应用需 SDK API 2.2.0 及支持多模态的 APK；不要手动降低构建生成的 requires.sdk。

- 云文件：app.cloud.files.upload(path, { mime, visibility?, localScope?, signal?, requestId? }) 上传已存在的应用相对路径，默认 private、device 文件作用域。上传取消或失败保留本机文件；重试同一文件沿用 requestId（UUID 格式），不能用于其他文件。单文件 ≤10 MB，每账号每应用 ≤100 MB、1000 个文件；支持 JPEG/PNG/WebP/GIF、MP3/WAV/M4A、MP4、PDF、二进制。get(id) 读取自己的元数据，不存在返回 null；download(id, path, { localScope?, signal? }) 下载自己的文件；remove(id) 删除自己的云文件。private 没有公开 URL，只有当前账号能下载；public 返回可公开读取的 url，需共享时把 url 存入公共或房间记录。公开文件一旦分享，删除无法收回接收方已保存的副本。
- 实时房间：app.cloud.rooms.join(id, { signal? })，id 为字母开头的 1–64 位字母、数字、下划线或连字符。拥有同一应用和房间编号的登录用户均可参与，并改删 room.collection(name) 中的记录；房间编号是分享入口，不是角色权限。公共集合仍只有创建者可改删。需要私有群组或管理员角色时，不能用可分享房间冒充此类权限。
- room.send(event, data) 发送 ≤16 KB 的 JSON 对象；room.on(event, callback) 接收 { data, senderId, sequence }，返回取消订阅函数。事件不持久化、不自动重发，离线会错过；发送失败或超时可能已经送达，不把事件当可靠计费或计分依据。计分等使用房间集合的 increment，复用写入 requestId 去重。
- room.subscribe(callback) 通知连接状态、成员或集合变动；读取 room.status、room.members。每次恢复到 connected 后重新读取集合快照，不能仅靠先前事件还原状态。集合提供与 private/public 一样的 CRUD、increment、expectedVersion 和分页。房间保留数据，leave() 只关闭连接。
- 在组件 effect 中加入房间，清理时 abort 并 leave；不要在模块顶层连接。宿主在作品隐藏、切后台时暂停连接，返回后重新鉴权连接；切换账号永久关闭旧连接。暂停期间 send 返回 UNAVAILABLE，应用保留输入。单应用最多 4 个房间，宿主最多 16 个；单房间最多 64 条连接、每账号最多 4 条，单连接每分钟最多 120 个事件。

多模态仍使用原接口，例如：

本机文件可用 `app.files.readBase64(path)` 读取（最大 6 MB，账号作用域用 `app.scope("account").files`）；图片加对应 MIME 的 data URL 前缀，音频直接作为 data。无需为了让 AI 读取私有图片而公开上传。

```ts
const result = await app.ai.complete({
  messages: [{ role: "user", content: "看看这是什么？",
    attachments: [{ type: "image", url: imageUrl }] }],
}, { signal });
if (result.ok) showAnswer(result.text);
```
