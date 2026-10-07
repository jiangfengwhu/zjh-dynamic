---
version: alpha
name: 紫金花 Pixel Street
description: 以金色像素伙伴为主角的应用近况与创作社区。
colors:
  primary: "#FFD337"
  on-primary: "#30233F"
  background: "#19152C"
  surface: "#25203A"
  text: "#FFF6E8"
  muted: "#BDB0CC"
  border: "#42394D"
  border-strong: "#665575"
typography:
  body:
    fontFamily: "Fusion Pixel 12px Proportional SC"
  utility:
    fontFamily: "Fusion Pixel 12px Proportional SC"
rounded:
  DEFAULT: "0px"
spacing:
  page: "16px"
  item-gap: "0px"
components:
  button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.DEFAULT}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.DEFAULT}"
  caption:
    textColor: "{colors.muted}"
  rule:
    backgroundColor: "{colors.border}"
  frame-edge:
    backgroundColor: "{colors.border-strong}"
---

# 紫金花设计语言

## Overview

宿主支持 Pixel Street 与 Soft。前者采用像素字体与图标、多巴胺亮色和利落轮廓；后者采用系统字体、线性图标、柔和圆角和紫色主动作。两套皮肤共用内容结构和交互规则，深浅模式独立于皮肤。应用默认继承，品牌区域可局部固定皮肤。交互规则见 [UX-CONTRACT.md](UX-CONTRACT.md)，不在本文件重复维护。

## Colors

`packages/ui/theme.ts` 是设计变量与皮肤的唯一运行时来源。Pixel Street 与 Soft 各包含深浅模式，模式可跟随系统；页面通过 useTheme 读取所属 Provider 的不可变主题，不从背景色推测模式。语义变量包含颜色、typography、spacing、radius、components 和 motion。

深色以紫黑画布、奶油白文字、亮黄主动作构成层级；浅色沿用同一语义映射。莓粉、薄荷绿、蓝紫用于状态与少量强调。评论标题和输入操作区沿用画布底，输入框用中性 surface；状态色不铺满正文。中央发布动作采用兰紫色，与黄色激活 tab 区分。

## Typography

Pixel Street 正文使用 Fusion Pixel 12px Proportional SC，Soft 使用系统字体，等宽角色使用主题的 mono。字体由皮肤主题与 `packages/ui/primitives/Typography.tsx` 宿主适配提供，尊重显式 fontFamily，保留原生 ref、字号缩放、选择和可访问语义；不替换 React Native 全局 Text 或 TextInput。字体文件及授权在 `apps/mobile/src/shell/feed/assets/font`，遵守 OFL；不将正文转成位图。

## Layout

列表以连续行和细分隔线组织，页面常规边距 16。动态身份、正文与操作栏使用共享结构；作品列表使用 WorkCard 的图标与摘要，截图放在详情或编辑页。空状态、加载、手势和页面生命周期以交互契约为准。

标题、分页栏与正文层级稳定。

## Elevation & Depth

通过画布、surface、细边框和文字对比区分层级，不依赖随机阴影或大面积渐变。覆盖层必须有明确关闭方式；提示不能遮挡关键操作。

## Shapes

Pixel Street 框架默认直角，Soft 使用主题定义的柔和圆角。按钮、表面、输入与弹窗分别使用语义形状变量。用户头像统一通过 UserAvatar 显示圆形图片，无头像或加载失败时使用内置 avatar.webp，不用姓名首字占位；抽屉和共享新数据提示使用已有组件的圆角例外；新数据提示为亮黄胶囊，带上箭头及可用头像，不扩散为普通卡片样式。

## Components

App 图标使用深紫底、金色五瓣像素紫金花及淡紫花芯，桌面图标、启动页和应用信息共用同一形象；用户默认头像仍使用像素伙伴。Jolly 头像统一使用 jolly_idle 内置首帧，制作通知按类型识别 Jolly，静态头像不加载视频。

语义颜色、字体、Icon／SymbolIcon 和共享媒体组件由 packages/ui 统一提供。Pixel Glyph 与线性图标由皮肤选择；基础组件保留原生布局和交互；宿主内部适配按钮意图、输入标签、确认行为与皮肤形状。SDK 提供可选基础控件、主题、图标、EmptyState、Skeleton 和媒体能力。皮肤不得改变权限、数据状态、禁用语义或触控热区。复用已有按钮、确认弹窗、toast、分页、刷新指示器与 NewDataNotice，不为同一能力另造组件。关注／粉丝与私信沿用像素字体、统一头像和连续行列表；自己的私信使用亮黄气泡，发送与私信入口用兰紫，关注用亮黄，未读会话以淡兰紫提示。共享切换栏不加整体外框，保留黄色、薄荷绿等多巴胺亮色选中背景，标签颜色同步跟随分页进度。可点击目标至少 44 点；视觉图标可以更小，热区仍需完整。

## Do's and Don'ts

- 用语义色适配深浅主题，保留系统字体缩放和可访问标签。
- 不用虚构数据或状态装饰页面，不重复已有操作入口。

## Runtime ownership

`theme.ts` 定义四套不可变主题，ThemeProvider 仅负责子树选择，不写存储；createThemedStyles 按主题对象缓存样式。primitives 提供原生属性与 ref 完整的宿主基础交互，chrome 提供表面、图标和页面结构，feedback 提供加载、空状态和弹窗。成熟共享库直接使用，不维护 beautiful／shadcn 演示集合。

宿主 App 的 HostAppearance 持有偏好；外观页仅提供皮肤和显示模式选择，即时修改上下文，空闲时保存到 MMKV。皮肤切换不重载应用，不丢失草稿、路由和列表状态。应用模块入口为原生 Text、TextInput 及动画文字补充所属主题的默认字体，保留显式字体与原生属性，不修改 React Native 全局导出。动态 HTML 统一跟随皮肤字体，忽略内联 font-family，代码区域使用主题等宽字体。

SDK 公共 UI 提供主题令牌、基础控件、图标、表面、空态、骨架、加载反馈、对话框与媒体适配；具体导出以 packages/app-sdk/src/host-ui.ts 为准。不提供宿主顶栏、返回按钮、安全区容器、动态卡片或制作输入栏。布局与成熟功能交给原生组件和共享库，兼容行为以 SDK 大版本契约为准。

基础交互与反馈恢复原生组件和既有皮肤实现。表单状态使用 React Hook Form，请求与内存页面缓存使用 TanStack Query，持久化仍由既有存储承担。
