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

本轮由用户明确授权全 App 的 pixel art 方向，先迁移宿主动态页。面向在手机上浏览应用近况、体验作品和分享发现的人。当前中文界面，保留现有账号、应用安装和社区数据契约。

多巴胺配色以奶油白和亮黄建立基调，莓粉、薄荷绿、蓝紫用于分类、状态与点击反馈，正文保持深色可读。按本轮验收反馈，动态页删除角色欢迎卡和应用朋友栏，以紧凑时间线为核心，新角色仅用于头像和空状态。奖项品质是持续评审目标，不是可由静态审查证明的结论。

运行时采用 Model B：`apps/mobile/src/shell/feed/pixelTheme.ts` 是动态页语义色唯一所有者，本文件记录该源的设计意图。`packages/ui/theme.ts` 保持 SDK 公共契约；宿主 `ThemeContext` 只在动态页覆盖语义色，`themedStyleSheet` 经 `pixelTheme` 适配。市场、我的和应用自绘内容按后续专项逐步迁移。

## Colors

深色画布、卡片、文字和边框见 frontmatter。浅色映射：画布 `#FFF9ED`、卡片 `#FFFFFF`、正文 `#30233F`、次要文字 `#796A7F`、边框 `#E9DFD7`、强边框 `#D2BFCF`。金色主操作在两种主题均为 `#FFD337`；浅色文字链接改用 `#885400`。危险与成功角色沿用共享主题语义色。

## Typography

宿主动态文字、导航及共享 PostFrame 文字使用 Fusion Pixel 12px Proportional SC（上游 2026.09.25，OFL-1.1）。正文 15 / 22，页标题 24 / 32。APK 1.4 将固定 OTF 注册到 ReactFontManager，`PixelText.tsx` 使用原生 Text；正文 Markdown 由共享 `RichMarkdown` 使用同一原生字体。中文换行、省略号、选择、内联链接、系统字体缩放和原生可访问语义都由原生文字提供。动态包不再携带字体的 base64 或维护文字位图缓存；应用自绘内容仍由应用控制。

字体源、原始许可证及上游字体许可证在 `feed/assets/font/`；Android 壳维护同一字节的字体资源和随 APK 分发的许可证。不修改字体字形与名称，不依赖联网加载字体。字体所有者是该固定 OTF，字号仍由组件样式持有；本文件只记录映射。

## Layout

顶部保留紧凑页头，分类与标题左侧同为 16，集成在滚动显隐头部。“发动态”固定右下角，位置跟随底部导航的显示进度并避开系统安全区。动态 item 无外框、无卡片间距，以浅色 0.5 单位分割线隔开，列表右侧留白增加 12 单位。宿主 item 与共享 PostFrame 的内部 padding、margin、gap 相比第一版约减半；操作栏视觉高度 32，垂直 hitSlop 6，点击热区保持 44 单位。帖子使用自然高度，媒体保留宽高比。

## Elevation & Depth

控件与头像使用实线建立像素边缘，动态列表使用浅色 0.5 单位分割线和紧凑留白，不使用外框或厚底沿。不使用模糊阴影、玻璃层或随机渐变。角色素材原有白底保留。

## Shapes

控件保留像素方形，头像全部圆形，选中分类用 16 × 4 的像素短线。SVG 图标采用 16 格网，头像保留角色原始比例。图片正文沿用内容图像，不将照片强行像素化。

## Components

`PixelKit.tsx` 拥有像素图标与角色静态图。`PixelPostFrame.tsx` 是宿主默认动态 item，应用登记的内容仍由应用负责。`FeedPresentationContext` 让共享 PostFrame 在动态页采用紧凑间距与宿主像素文字，在其他位置保留原展示。`UserPostCard`、`FeedScreen` 与动态页导航使用统一语义色。业务可点击目标最小 44 单位，选中状态有文字／形状标识。

本轮删除欢迎区后不再在动态页播放角色动画，三份用户 MP4 源素材保留供后续页面使用，当前宿主包只内嵌头像。头像源资源修改后运行 `node scripts/embed-feed-assets.mjs`；字体改变需协调新 APK。

## Do's and Don'ts

- 先保证正文、分类和动作可识别，再增加像素装饰。
- 不虚构活跃人数、等级、奖励或实时状态；页面数量来自现有数据。
- 不修改应用 ID、数据键、vendor 键或应用自定义卡片契约。
- 后续迁移依据同一 token 所有者，不为每个页面另造色板。

全局 RN Text / TextInput 在宿主初始化时统一使用像素字体，主题三个字体 token 一致。分类栏属于滚动显隐头部；右下角发布只显示加号。用户与应用动态共用 FeedActionBar，操作栏无边框，item 使用浅色 0.5 分割线。

顶部滚动：头部偏移不得超过列表实际偏移。列表尚未滚过整个头部时不吸附隐藏，消除轻滑后的占位空白。头部不再绘制滚动态底线；分类底部不加额外 padding。
