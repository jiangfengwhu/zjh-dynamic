# 宿主动态页交互契约

视觉意图与 token 映射见 [DESIGN.md](DESIGN.md)。这里只记录现有产品行为与本轮迁移边界。

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Toast | react-native-toast-message | apps/mobile/App.tsx 与各操作回调 | success / error / info | 源码追踪；真机待验收 |
| CRUD | navigation.tsx / userPosts.ts | 现有账号与帖子 API 实现 | 发布 / 详情 / 原生删除确认 | 源码追踪；运行时流程待验收 |
| Scrollbar | RN ScrollView / FlatList | 平台原生滚动实现 | 水平朋友栏、分类 / 垂直列表 | 原生指示器开启；真机待验收 |

| 能力 | 所有者／证据 | 约定 |
| --- | --- | --- |
| 路由 | apps/mobile/src/shell/navigation.tsx | 发动态、作者主页、动态详情、通知沿用现有回调；不改保存返回行为 |
| 分类与列表 | apps/mobile/src/shell/feed/FeedScreen.tsx | 全部／用户／已有应用类别；按创建时间排序，切换后归顶；用户动态显式加载更多 |
| 同步 | userPosts.ts、pullToRefresh.ts | 刷新失败保留内容，内联提示并可下拉重试；加载更多使用既有分页游标 |
| 点赞 | likes.ts、UserPostCard.tsx | 用户帖子登录与请求防重沿用现有账号和接口；选中状态向辅助技术公开 |
| Toast | react-native-toast-message／宿主 provider | 操作失败与成功沿用共享通知；关键同步错误同时内联展示 |
| 删除 | UserPostCard.tsx、userPosts.ts | 沿用 RN 原生确认和服务端删除行为；不增改数据生命周期 |
| 头像和卡片 | runtime/application metadata、CardSlot.tsx | 宿主默认应用用新角色，其他应用身份保持；自定义卡错误仅降级当前卡 |
| 主题 | packages/ui/theme.ts → feed/pixelTheme.ts | 深浅主题沿用账号外观选择；仅迁移动态页语义表面 |
| 动画 | PixelKit.tsx | 一处视频，静音；后台、失焦与离开欢迎区暂停；减少动态效果／媒体失败回退头像 |
| 滚动条 | RN ScrollView／FlatList | 使用平台原生滚动指示器，不引入 Web CSS 或隐藏主要滚动提示 |
| Form / Select / Date / Table Selection | 本轮不涉及 | 编辑、账号与设置现有流程保持原所有者 |

业务来源是现有宿主实现及用户本轮视觉迁移授权；本轮没有引入权限、支付、奖励、上传规则或服务端生命周期决策。账号验证由 `account.ts` 的 `requireAccount` 负责。中文无新增 locale 提供者；相对时间继续沿用动态页原有逻辑。

验收必须区分静态源码、编译与实际设备行为；静态检查不能证明真机字体、视频解码、手势或屏幕阅读器体验，也不能证明奖项品质。仓库规定默认不单独运行类型检查、测试或预览；发布仍须按 README 提交源码、校验契约与实际上传。
