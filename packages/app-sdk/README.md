# 紫金花应用 SDK

## 必读指引

Node.js ≥22.11.0。插件根目录 npm ci；任务与交付规则见 AGENTS.md。

入口默认导出 defineApp({main})，main 返回页面组件。API 用 @zijinhua/app-sdk，UI 用其 /ui；参数查公共类型，下文按需查阅。

共享入口/版本查 dist/platform.json、dist/libraries.md；禁止私有路径、重复安装共享库和 overrides。额外纯 JS 依赖写应用 package.json，npm install 后提交根锁文件；原生能力需配套 APK。

新应用 authorize→init，已有应用仅 authorize。交付仅运行 publish，自动提交当前应用与根锁文件、构建并验证线上候选；授权与兼容校验不可绕过。

```sh
npx --no-install zjh-app authorize <id> '<grant>'
npx --no-install zjh-app init <id>
npx --no-install zjh-app publish <id>
```

## 全屏布局

根容器 flex: 1，背景延伸到屏幕边缘；宿主不添加安全区 padding，但设备 inset 仍存在，文字和按钮应避让。SDK Screen、ScreenBar 已处理相应安全区，不重复叠加 SafeAreaView 或固定系统栏高度，不自行隐藏系统栏。

宿主已挂载 GestureHandlerRootView、SafeAreaProvider、KeyboardProvider、BottomSheetModalProvider 和 Toast。使用 app.toast；独立导航用 NavigationIndependentTree 包裹 NavigationContainer。权限仅由用户操作触发。

## 资源与媒体

资源放 assets/，用 getAppContext().assets.uri(name)，不用 require 图片。存储与文件用 AppContext，按应用 ID 隔离；文件路径必须相对应用目录，下载仅 HTTPS，不读取宿主凭据；共享 JS 环境不构成安全沙箱。

选图、图片、正文优先用 /ui 的 MediaPicker、AppImage、RichMarkdown。头像裁剪传 cropping/cropperCircleOverlay/width/height；取消错误为 E_PICKER_CANCELLED。选图临时文件上传或复制草稿后 cleanSingle，不作永久地址，不删相册原件。Markdown 流式传 markdown/streaming；默认链接支持 HTTP(S)、mailto、tel，自定义路由用 onLinkPress。

## 用户动态

用户点击才调用 feed.share({ body, html, requestId })；需要编辑则 feed.compose。作者由登录账号确定，取消登录不发布。SDK 2.0 不支持 cards 和旧 feed.publish/upsert/remove/recordChange，旧应用须重建。

body ≤2000 字、html ≤32 KB，至少一项。HTML 保存快照，支持基础文本标签、a/img 和内联文字、颜色、间距、边框、圆角、尺寸、简单布局；支持 div/p/span/h1-h4、strong/b/em/i/u/s、br/hr、ul/ol/li、blockquote/pre/code。不支持样式表、复杂选择器、脚本、事件属性、iframe、外部字体；服务端清理不支持内容。媒体须稳定公开 HTTPS 地址，不用本地文件、临时签名或模板变量；链接可用 zijinhua://app/<appId>。不导入宿主内部 @native-html/render。

失败重试复用 requestId；新操作换 ID，格式为 8–100 位字母、数字或短横线。PostFrame 只自绘 content 内容区，不重复头像、姓名时间或交互栏；content=null 留空，省略保留默认正文，body/children 兼容。

## 版本与市场信息

application.json 填 title（≤60 字）、summary（≤300 字）、mark、accent、version、releaseNotes；每轮写真实更新日志。像素图标用 defineApp 的 avatar，遵守 AppAvatarProps 的尺寸与圆角；图片走资源 API。未加载时用 mark/accent，占位不会执行 avatar；图标图片和截图不自动上传，分类及截图由作者上架时选择。

## AI 与制作

AppContext.ai 提供 listProviders、complete、openSettings。密钥保存在宿主，不向应用暴露；失败保留输入、不自动重试，当前仅文本、非流式，不支持图片或工具调用。

/creation 仅向宿主授权的 Jolly 开放，不授予普通应用制作权限；会话按 appId 隔离，缓存不代替实时鉴权。提交只创建任务；watchJulesSession 仅查一次，不轮询；进度手动刷新，交付通知由服务端负责。

## 构建与兼容

publish 仅上传候选，不自动上架，公开版本由作者选择。publish 自动提交当前应用目录与根锁文件，存在其他改动则停止；自动构建、上传后回读线上候选，确认输出 published:true、appId、releaseId、commit 才算交付成功，回执保存在 dist/applications/<id>/publication.json。单独构建不会发布，用 npx --no-install zjh-app build <id>，产物在 dist/applications/<id>/。发布只接受 origin 为 jiangfengwhu/zjh-plugin 的干净源码；校验本轮授权、原子基线、RN/Hermes ABI、SDK 同主版本且宿主不低于需求、所用共享依赖精确版本。冲突或不兼容时保留源码并处理原因，不改清单绕过校验。
