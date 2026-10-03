---
version: alpha
name: 紫金花 Pixel Street
description: 以金色像素伙伴为主角的应用近况与创作社区。
colors:
  primary: "#F2C665"
  on-primary: "#30213D"
  background: "#171322"
  surface: "#231D32"
  text: "#FFF4DE"
  muted: "#B8A6C9"
  border: "#433653"
  border-strong: "#806995"
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

金色负责主操作，紫色负责空间层级。按本轮验收反馈，动态页删除角色欢迎卡和应用朋友栏，以紧凑时间线为核心，新角色仅用于头像和空状态。奖项品质是持续评审目标，不是可由静态审查证明的结论。

运行时采用 Model B：`apps/mobile/src/shell/feed/pixelTheme.ts` 是动态页语义色唯一所有者，本文件记录该源的设计意图。`packages/ui/theme.ts` 保持 SDK 公共契约；宿主 `ThemeContext` 只在动态页覆盖语义色，`themedStyleSheet` 经 `pixelTheme` 适配。市场、我的和应用自绘内容按后续专项逐步迁移。

## Colors

深色画布、卡片、文字和边框见 frontmatter。浅色映射：画布 `#F1EDF8`、卡片 `#FFFCF5`、正文 `#2E2141`、次要文字 `#705D80`、边框 `#D5C8E5`、强边框 `#8C729F`。金色主操作在两种主题均为 `#F2C665`；浅色文字链接改用 `#765000`。危险与成功角色沿用共享主题语义色。

## Typography

宿主动态文字、导航及共享 PostFrame 文字使用实际嵌入的 Fusion Pixel 12px Proportional SC（上游 2026.09.25，OFL-1.1）。正文 15 / 22，页标题 24 / 32。`PixelText.tsx` 经已固定版本的 Skia 加载 OTF、测量段落并生成 CPU 位图，由原生 Image 呈现；不需要新 APK 或新增原生接口。位图缓存上限 160 项、约 2 MB，支持中文换行、省略号、系统字体缩放、原生可访问标签。详情可选中文字和带内联链接的 Markdown 使用原生文字，保留选择和链接能力；应用自行绘制的内容仍由应用控制。

字体源、原始许可证及上游字体许可证在 `feed/assets/font/`，生成字节在 `pixelFontAsset.ts`；不修改字体字形与名称，不依赖联网加载字体。字体所有者是该固定 OTF，字号仍由组件样式持有；本文件只记录映射。

## Layout

顶部保留紧凑页头，分类集成在列表上方“最新动态”区域。“发动态”固定右下角，位置跟随底部导航的显示进度并避开系统安全区。动态 item 无外框、无卡片间距，以 1 单位分割线隔开。宿主 item 与共享 PostFrame 的内部 padding、margin、gap 相比第一版约减半；点击热区继续保持至少 44 单位。帖子使用自然高度，媒体保留宽高比。

## Elevation & Depth

控件与头像使用实线建立像素边缘，动态列表仅使用分割线，不使用外框或厚底沿。不使用模糊阴影、玻璃层或随机渐变。角色素材原有白底保留。

## Shapes

控件与头像框方形，选中分类用 16 × 4 的像素短线。SVG 图标采用 16 格网，头像保留角色原始比例。图片正文沿用内容图像，不将照片强行像素化。

## Components

`PixelKit.tsx` 拥有像素图标与角色静态图。`PixelPostFrame.tsx` 是宿主默认动态 item，应用登记的内容仍由应用负责。`FeedPresentationContext` 让共享 PostFrame 在动态页采用紧凑间距与宿主像素文字，在其他位置保留原展示。`UserPostCard`、`FeedScreen` 与动态页导航使用统一语义色。业务可点击目标最小 44 单位，选中状态有文字／形状标识。

本轮删除欢迎区后不再在动态页播放角色动画，三份用户 MP4 源素材保留供后续页面使用，当前宿主包只内嵌头像和字体。源资源修改后运行 `node scripts/embed-feed-assets.mjs`。

## Do's and Don'ts

- 先保证正文、分类和动作可识别，再增加像素装饰。
- 不虚构活跃人数、等级、奖励或实时状态；页面数量来自现有数据。
- 不修改应用 ID、数据键、vendor 键或应用自定义卡片契约。
- 后续迁移依据同一 token 所有者，不为每个页面另造色板。
