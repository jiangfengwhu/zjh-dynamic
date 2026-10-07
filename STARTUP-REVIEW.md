# 首屏与冷启动改动记录

2026-10-07：完成 zjh-dynamic RN 宿主与 zjh-android 原生启动链路的第一轮优化。本文记录当前实现和待测项；SDK 使用规则仍只维护在 packages/app-sdk/README.md。

## 已落实

- 主 tab 使用 lazy=true、lazyPreloadDistance=0；ShellTabScene 只在首次聚焦时挂载内容，取消预热队列和跨进程场景就绪标记。访问后的状态与滚动位置保留。
- 抽屉取消一秒定时准备，点击或用户开始拖动时才挂载内容，关闭后保留内容状态。
- 非首页导航页面通过稳定的 lazyScreen 包装组件按需 require；设置、市场、通知、主页、聊天、详情、发布和 Jolly 进度页不再由导航静态引入。navigationRef 独立，使用导航引用不会初始化页面模块。
- 首页、市场、通知、个人/作者主页与关注/粉丝分页复用 useVisitedPager：保留 PagerView 页面壳，用户点击或横划实际揭示页面才挂载列表。去掉首页相邻页空闲准备；访问后的列表保留。
- 首页安装快捷入口仅在安装分页选中时读取；关注流仅在该分页选中时恢复缓存并订阅，登录恢复和关注操作不再为未访问的关注流自动发起请求。
- 没有成功缓存的推荐流立即开始必要请求；缓存刷新继续在空闲时间静默执行，并保留新动态提示语义。
- SDK UI、制作服务、照片选取、上传传输和 HTML 正文渲染入口改为按能力使用加载，公共入口键和版本契约保持不变。
- 推荐流先通知内存订阅者，再在空闲时间保存完整 timeline，并跳过已被更新替代的写入。
- RN 取消启动后的 syncPlugins 调用；Android 保留该桥接入口，直接复用已注册插件，不再重复加载当前 DEX。
- Android 将包准备、哈希校验和 DEX 注册移到 ShellStartup 后台线程。完成之后才启动 ReactHost 和创建 Surface；Activity 先建立启动图和原生容器。销毁后的 Activity 不接收迟到 Surface，提前到达的 Intent 保存在 Activity 上供初始链接读取。
- 激活与回退不再同步执行常规 gc，包健康后统一延迟回收。每次宿主重载成功也回收，WorkManager 注册与提醒恢复仍每进程只做一次。
- 原生增加启动失败与 30 秒超时恢复页。准备失败可重新准备，已创建 RN 时可重载；失败展示与健康确认分开，保留 boot.pending 和下一次冷启动回退。

## 当前 Release 链路

Application.onCreate → ShellStartup（prepareBoot、内置桥接和 DEX）→ 主线程 ReactHost.start → Activity 创建 ReactSurface → vendor-entry → NativePluginHost.loadApp → SplitBundle.load → app-entry / 平台绑定 → 首页与导航 → 根布局及导航就绪 → bundleReady → 释放原生启动图。

首页数据与安装元数据恢复是独立路径，不影响 bundleReady。Debug 使用 index.js/Metro，不能替代分层 Release 启动测量。vendor 共享库工厂本身已经懒加载；取消隐藏页预加载不意味着必须物理拆分每个页面 bundle，未访问模块仍可作为未执行的模块定义存在于 app 包中。

同级分页继续支持点击和原生跟手横划。第一次横划开始揭示的目标页会按需挂载，低性能设备的首次重内容挂载成本仍需测量。服务端既有聚合响应可能同时返回主页动态与作品，客户端不额外请求隐藏分页。

## 验证与交付边界

已通过 Metro/Hermes 本地打包、APK 资源准备、Codegen、Release APK 构建和两个仓库的 diff --check；未安装 APK，未单独运行类型检查、测试或预览。UI 技能的静态扫描将 React Native Button.onPress 误识别为两个无操作按钮，已人工核对既有操作均有效；静态扫描不能替代设备验证。

RN 动态改动通过宿主包交付；原生后台启动、失败兜底和插件入口优化需要新 APK。首次本地构建读取的是改动前的线上 RN 包，之后按运行时契约配套发布了宿主包与 APK。

2026-10-07 发布完成：APK 1.11.4（versionCode=25）内置宿主 release 397a1de97d47b3ac6f74fdef69da34dd426d422bb5719d421a2a80433205a6c9。RN 源码提交为 6569dc005ed1daa3e4afe696e5c3de8be135be37，APK 源码提交为 b86d7c60f78dc22058cdb709248e81505ab16c50，发布时两者 source.dirty=false。已核对线上 runtime、release、apk 的运行时指纹一致，以及 APK 下载地址和文件体积；仍未进行真机联合验证。

## 仍需测量和后续优化

- 用 Release 真机分别测普通冷启动、首次安装/升级、暂存更新激活、失败回退、游客/登录、离线/弱网与深链。记录 TTID、TTFD、主线程磁盘、JS 执行及掉帧，比较多次样本中位数和 P95；本次没有实测收益毫秒数。
- startupTiming 从该模块执行开始计时，Android 日志从对应准备阶段开始；二者没有统一时钟。根布局、导航和数据就绪均不证明实际显示帧。后续补 Android Trace 与 FullyDrawnReporter/reportFullyDrawn。
- 首次安装仍存在 asset→blob→live 的 vendor 复制；后台化解除主线程阻塞，但没有减少总读写量。减少重复复制必须继续保证固定加载路径、原子替换、包哈希与失败恢复。
- 推荐流仍有 pageCache 与 social.timeline 两份快照，安装元数据恢复与安装列表也仍有独立扫描；后续可在保留账号隔离和目录修改优先语义的前提下统一来源和建立索引。
- 图片/HTML 的首批数量和宽度变化成本、账户复核/WebSocket 的资源竞争，需按真实首屏与设备数据调整，不凭代码猜收益。
- 原生依赖已有合并 profile；尚无本项目专用 Baseline/Startup Profile 生成流程。它优化 Android ART 路径，不直接编译 Hermes JS。

依据：[RN JavaScript 加载优化](https://reactnative.dev/docs/optimizing-javascript-loading)、[Android 启动时间](https://developer.android.com/topic/performance/issues/launch-time)、[Baseline Profile 创建](https://developer.android.com/topic/performance/baselineprofiles/create-baselineprofile)。

此前文档核对已修正 Android 的 Compose 描述、启动条件与清理时机，以及 dynamic 的作品登记来源、SDK UI 导出、Query 重新挂载行为和日志范围。SDK 共享库清单与 platform.json 一致；现有文档各有用途，没有整份删除。
