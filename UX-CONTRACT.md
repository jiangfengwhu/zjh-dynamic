# 宿主动态页交互契约

视觉意图与 token 映射见 [DESIGN.md](DESIGN.md)。这里只记录现有产品行为与本轮迁移边界。

## Canonical UI Map

| Capability | Canonical owner               | Source of truth                  | Allowed variants            | Verification               |
| ---------- | ----------------------------- | -------------------------------- | --------------------------- | -------------------------- |
| Toast      | react-native-toast-message    | apps/mobile/App.tsx 与各操作回调 | success / error / info      | 源码追踪；真机待验收       |
| CRUD       | navigation.tsx / userPosts.ts | 现有账号与帖子 API 实现          | 发布 / 详情 / 原生删除确认  | 源码追踪；运行时流程待验收 |
| Scrollbar  | RN ScrollView / FlatList      | 平台原生滚动实现                 | 水平朋友栏、分类 / 垂直列表 | 原生指示器开启；真机待验收 |

| 能力                                   | 所有者／证据                                          | 约定                                                                                                    |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 路由                                   | apps/mobile/src/shell/navigation.tsx                  | 发动态、作者主页、动态详情、通知沿用现有回调；不改保存返回行为                                          |
| 分类与列表                             | apps/mobile/src/shell/feed/FeedScreen.tsx             | 为你推荐展示社区用户动态（目前按时间排序），正在关注仅展示当前账号关注的作者；独立分页与滚动位置，显隐不因切换改变 |
| 同步                                   | userPosts.ts、pullToRefresh.ts                        | 刷新失败保留内容，内联提示并可下拉重试；加载更多使用既有分页游标                                        |
| 点赞                                   | likes.ts、UserPostCard.tsx                            | 用户帖子登录与请求防重沿用现有账号和接口；选中状态向辅助技术公开                                        |
| Toast                                  | react-native-toast-message／宿主 provider             | 操作失败与成功沿用共享通知；关键同步错误同时内联展示                                                    |
| 删除                                   | UserPostCard.tsx、userPosts.ts                        | 沿用 RN 原生确认和服务端删除行为；不增改数据生命周期                                                    |
| 头像和卡片                             | runtime/application metadata、CardSlot.tsx            | 宿主默认应用用新角色，其他应用身份保持；自定义卡错误仅降级当前卡                                        |
| 主题                                   | packages/ui/theme.ts → feed/pixelTheme.ts             | 深浅主题沿用账号外观选择；仅迁移动态页语义表面                                                          |
| 字体                                   | globalTypography.js / theme.ts / APK ReactFontManager | 原生中文像素字体；系统字号缩放、选择、链接和原生可访问语义统一保留                                      |
| 图片                                   | packages/ui/media/AppImage.tsx                        | 默认延迟加载并按 URI 回收图片；特殊请求头、动画格式与事件回调沿用 RN Image                              |
| 选图                                   | packages/ui/media/MediaPicker.ts                      | 用户操作触发；全局防重；圆形头像裁剪、多选上限、JPEG 编码和尺寸约束；取消不提示错误；仅删除自身临时副本 |
| Markdown                               | packages/ui/media/RichMarkdown.tsx                    | 共享原生渲染、主题、字号缩放、选择菜单与链接策略；流式更新遵循系统减少动态效果设置                      |
| 滚动条                                 | RN ScrollView／FlatList                               | 按用户偏好隐藏动态列表与分类滚动指示器；分类随头部滚动显隐，发布按钮在右下角随底部导航显隐并避让安全区  |
| Form / Select / Date / Table Selection | 本轮不涉及                                            | 编辑、账号与设置现有流程保持原所有者                                                                    |

业务来源是现有宿主实现及用户本轮视觉迁移授权；本轮没有引入权限、支付、奖励、上传规则或服务端生命周期决策。账号验证由 `account.ts` 的 `requireAccount` 负责。中文无新增 locale 提供者；相对时间继续沿用动态页原有逻辑。

验收必须区分静态源码、编译与实际设备行为；静态检查不能证明真机字体、视频解码、手势或屏幕阅读器体验，也不能证明奖项品质。仓库规定默认不单独运行类型检查、测试或预览；发布仍须按 README 提交源码、校验契约与实际上传。

动态页滚动约定：头部偏移上限为头部高度，分类切换不按新列表偏移重置，顶部区域不执行隐藏吸附；分类与标题左对齐，滚动无额外顶栏线。列表 item 仅使用共享容器的对称横向内边距，条目间为 0.5 浅色分隔。配色所有者仍为 pixelTheme.ts，加入莓粉、薄荷绿、蓝紫与亮黄，文字语义和路由不变。

用户与应用动态共享 FeedItemFrame 渲染结构，内容插槽对应 PostFrame.content；菜单为身份行的附加入口，头像和姓名触达作者／应用。用户正文打开详情、图片预览、删除确认、点赞鉴权与防重、系统分享行为保持。应用 content/body/children 原有契约兼容，不改变数据或服务端接口。

系统导航可见性由 Android MainActivity 与 react-native-screens 原生适配统一持有，保持可见且背景透明；页面 systemBars 调用只设置配色，应用 tab 显隐不再参与系统导航栏生命周期。键盘由现有 KeyboardProvider／IME insets 保持原有所有者。

底部 tab 由 scroll worklet 在同方向累计 24 点后切换 0/1 显隐目标，并以 180ms cubic-out 过渡到终点，顶部单独保持跟手，不做延迟吸附；SHELL_BOTTOM_PADDING=16 为底部布局唯一附加留白。FeedActionBar 在成功确认 false→true 时播放点赞动画，初始恢复、取消点赞与失败不播放，忙碌禁用和计数仍按真实状态。依用户偏好，新增点赞与刷新动画固定播放。刷新完成／失败强制 rotate=0，避免旧变换残留。

首页手势与导航：底部路由禁止横划。分类按全部、用户、应用类型排列，原生 PagerView 负责双向跟手分页；动态仅“全部”分类右滑打开抽屉，其他分类右滑返回前一分类。应用市场与通知右滑同样可呼出抽屉；主页面保持原位。抽屉右侧 24 圆角，与主画布同色，复用 MineScreen 无 header 变体；遮罩、底部收起、左滑与系统返回均可关闭。分类列表保留稳定的手势容器与已访问页，空闲预热相邻页，避免切换时卸载卡片。圆形发布按钮随底部导航显隐；真实系统导航保持可见且透明。

APK 1.4.2：系统导航栏保持可见、透明背景，关闭导航栏对比度遮罩，全屏内容仍延伸至系统栏底下；应用 tab 留白使用真实底部安全区。页面导航选项不再隐藏系统导航，避免导航手势需要先唤出系统栏。

头像对齐：动态紧凑帧的 44 点头像列从 x=16 开始，36 点头像左边为 x=20；header 复用相同列尺寸和 5 点列间距，标题从 x=65 开始。header 右留白为 24；动态 item 不加额外右内边距，使用共享容器的对称横向内边距。动态列表、分类与抽屉隐藏滚动条。

动态分类各自保留原生列表正文滚动位置；每个 FeedScrollSurface 持有自己的 UI 线程 offset，不使用共享位置表逐帧复制；顶部、底部及发布按钮的显隐状态由动态页统一持有，分类切换不重置，仅真实纵向拖动和惯性滚动更新。非当前分类及布局事件不得改动显隐状态，不调用归顶。FeedCategoryTabs 的单个 indicator 由原生 onPageScroll 在 UI 线程连续插值位置与颜色，不经 JS 每帧重渲染。ProfileDrawer 松手采用 220ms 无回弹 timing，抽屉右侧 24 圆角，覆盖主页面，使用 pixelTheme.canvas。发布按钮 48×48、半径 24。底部导航所有 route 使用相同像素配色、透明导航容器和 12 圆角选中背景，选中仅淡入，不做弹簧缩放。

动态正文图片及网格裁剪容器统一使用 12 圆角；图片预览保持全屏原图。

交互优先原则：先响应用户点击、拖动、分类切换与路由操作，再安排非必要工作。抽屉路由入口立即导航，抽屉同步复位，不叠加收起动画；手动刷新、发布、点赞等显式操作立即执行。自动初次同步、通知轮询使用可取消的空闲任务；分类预热在原生 pager idle 后执行，拖动与 settling 时取消。通知计数相同不广播，计数展示使用 React transition；用户和应用动态 item 采用 memo 边界与稳定回调，局部状态变化不重绘无关正文。不得用忽略真实内容变化的比较函数掩盖重绘。

分类共享 header 高度范围内的折叠滚动区：活动页由手指或惯性滚动驱动 header，非活动页仅当 offset 不超过 header 高度时同步到共享折叠量；正文区 offset 大于 header 高度的分类保持独立位置。同步在 UI 线程执行，无动画，不干预活动手指、不经 JS 每帧更新。分类切换仅移交滚动所有权，不进行事后位置校正；新挂载列表在内容测量后初始化共享折叠量，避免顶部空白。底部 tab 容器透明、无边框，沿用主画布；仅选中 tab 有亮黄圆角背景，取消整条蓝色底色。

Drawer 开关保持遮罩与主页面原生父容器常驻，关闭只改变 pointerEvents、辅助技术状态与 UI 线程透明度；手势对象不随 opened 状态重建。像素头像采用 memo、稳定 source 和 Android fadeDuration=0，避免关闭后重复解码淡入。

Drawer 的“编辑头像与昵称”进入 account 路由时明确使用原生 slide_from_right、220ms 转场，返回沿用原生反向转场；不得以 animation:none 代替性能修复。Drawer 同步复位，不叠加收起动画。

用户动态列表详情热区由 UserPostCard 的整条 Pressable 持有，覆盖正文、身份行空白、头像列空白和内容留白；原有布局间距不变。外层 accessible=false，不吞并子控件的辅助技术入口。图片预览、头像／姓名、应用链接、菜单、点赞与分享仍由嵌套控件优先响应。详情页关闭整条点击入口，保留正文选择及评论输入操作；纯图片或应用分享动态同样可以从条目留白进入详情。

底部阈值策略由 FeedChrome.SHELL_CHROME_THRESHOLD=24 持有。向下滚过阈值隐藏，向上滚过阈值显示，回到列表顶端立即显示；换方向、开始新拖动、分类切换只清空累计距离，不重置当前显隐。发布按钮与底部 tab 使用同一二态目标和同一动画进度，180ms cubic-out 滑入／滑出，不停留在中间态。

底部动画由 FeedChromeProvider 单独持有：滚动只更新二态 target，useAnimatedReaction 仅在目标变化时启动 withTiming，连续滚动不会反复重启动画；反向跨过阈值时从当前进度平滑转向新终点。无弹簧，ReduceMotion.Never 遵循用户固定播放动画的偏好。

动态 item 的整条详情／主页热区不使用 pressed 背景、涟漪或高亮底色。共享 PostFrame 移除按下时 colors.inset 背景，仅保留既有点击入口与子控件独立交互。

动态 item 的 styles.post 仅保留 paddingVertical=3，删除 paddingRight=24。左右间距统一由动态列表 content 容器的 paddingHorizontal=16 持有，动态页 FeedItemFrame.frameInset=0，不重复叠加单侧 padding；整条点击热区随完整容器宽度扩展，不再额外补右侧 hitSlop。

分类与 Drawer 手势交接以 UI 线程原生事件为准：feedActive 只随大 tab 焦点变化，feedPage 由原生 onPageSelected／idle 更新，feedIdle 在 dragging／settling 及非零分页 offset 时为 false。新的触摸在实际原生分页位置为第 0 页“全部”边界时确定 Drawer 资格，不依赖可能晚到的 idle 通知；资格对本次触摸锁定，左滑判定失败后同一触摸不可转为 Drawer。分类状态更新和清理函数不得临时放开资格。实际分页到达“全部”边界时立即在 UI 线程开放，无需等待 idle 或 React 更新；市场、通知右滑入口保持。

分割线左右边距与紧凑动态容器共用 FeedScreen.FEED_PAGE_INSET=16；应用分享卡片、图片、正文的右侧内容边界和分割线终点一致。分割线不另加横向 margin，保持条目两侧对称，不额外缩窄应用卡片。

删除用户应用分享卡片单独的 9 点右 margin。正文、图片、用户分享卡片和其他应用自绘内容统一受动态列表容器的对称边界约束。

动态页容器统一边界：FlatList contentContainerStyle.paddingHorizontal=FEED_PAGE_INSET=16；item 容器 width=100%、minWidth=0、overflow=hidden、collapsable=false，保证自绘应用内容和媒体不会越过分割线边界。FeedPresentation.frameInset=0 只在此宿主列表取消内部重复横向间距，其他调用方仍保持原默认 7／14。分割线直接铺满同一列表内容宽度；header 头像同步对齐到 x=20，标题 x=65。

动态列表左右容器留白由 7 增至 16 点，统一由 FEED_PAGE_INSET=16 控制。分割线、图片与各类应用卡片共享此内容宽度；不额外为单条卡片加 margin 或 padding。Header 取消头像列的 -9 点补偿，同步与动态头像列对齐。

Drawer 首滑响应：feedPosition 直接复用原生 onPageScroll 的 position+offset，与 indicator 同源；onTouchesDown 在第 0 页且 position 距离 0 不超过 0.001 时锁定 eligible，后续不因该触摸自己触发 dragging 或晚到的 idle 被取消。非边界开始的分类滑动仍立即失败，方向变更不能重新获得资格，避免边滑分类边打开 drawer。

HTML 动态使用宿主 @native-html/render 1.0.3 转为原生视图，列表与详情共享 HtmlPostContent；身份和交互栏由 FeedItemFrame / FeedActionBar 持有。应用仅提交 HTML 快照，不注册动态模板、不需要安装应用才能展示。服务端按登录身份发布并清理标签、属性和内联样式；内容格式 html-v1，HTML 上限 32 KB、20 层嵌套，禁用脚本和外部样式表。正文和图片沿用现有用户发布流程，HTML 编辑／预览、失败重试和草稿自动保存沿用 ComposePostScreen。

SDK 2.0 feed.share 仅由明确用户操作触发，默认直接发布，不弹确认页；同账号、同应用、相同内容的并发点击复用请求，失败重试保留 requestId。feed.compose 显式进入编辑页。旧应用 publish/upsert/remove/recordChange 和 cards 注册接口删除；不兼容旧应用、不迁移历史应用动态、不执行清库。

关注由 userPosts.ts 和服务端 Posts 管理：作者主页关注/取消关注，登录验证，重复请求幂等，关注计数原子更新。关注列表只存于当前会话，切换账号立即清空；取消关注立即移除作者内容，关注后空闲刷新。推荐页第一屏右滑呼出抽屉，关注页右滑回推荐。顶部保留左侧头像，居中使用 APK 同源应用 Logo，分类 indicator 在 UI 线程随 native PagerView 跟手。路由由 JS 发起，页面和转场由 Native Stack 原生执行。

制作结果通知由服务端 Workshop Durable Object alarm 跟进，成功须同时完成 Jules 会话并存在本轮候选包，失败以终止/交付失败为准；主动暂停不记作失败。按账号、作品、制作轮次和结果幂等，持久化 outbox 重试，站内通知点击进入对应作品工坊。新轮次尚未被 Jules 接收时，不复用上一轮的终态。
底部导航固定为动态、应用市场、中央发布 icon、通知、我的。发布 icon 是动作，不是持久 tab；发动态和制作应用共用发布页，可切换并保留草稿。制作需求进入现有 Jolly 工坊确认流程。我的页复用作者动态列表和作品管理组件，动态/作品分别保持挂载和滚动位置，只刷新当前可见页。抽屉仅放账号编辑、AI 引擎、外观、更新与应用信息。已安装分享作品从本机打开，未安装才查询公开详情，账号私有安装遵循既有 owner 校验。
