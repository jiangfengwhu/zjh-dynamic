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

宿主采用 Pixel Street：紧凑时间线、像素字体与图标，亮色用于动作和状态。各页共用设计语言，应用自绘内容遵守 SDK 契约。交互规则见 [UX-CONTRACT.md](UX-CONTRACT.md)，不在本文件重复维护。

## Colors

`packages/ui/pixelTheme.ts` 是宿主语义色源，动态页的 pixelTheme 仅重导出；`packages/ui/theme.ts` 保持 SDK 公共契约。页面通过主题上下文取色，同时支持深浅外观，不硬编码整页颜色。

深色以紫黑画布、奶油白文字、亮黄主动作构成层级；浅色沿用同一语义映射。莓粉、薄荷绿、蓝紫用于状态与少量强调。评论标题和输入操作区沿用画布底，输入框用中性 surface；状态色不铺满正文。中央发布动作采用兰紫色，与黄色激活 tab 区分。

## Typography

正文与工具文字使用 Fusion Pixel 12px Proportional SC。字体由 `apps/mobile/src/runtime/globalTypography.js`、PixelText 与 APK 原生字体适配共同持有，保留系统字号缩放、选择和可访问语义。字体文件及授权在 `apps/mobile/src/shell/feed/assets/font`，遵守 OFL；不将正文转成位图。

## Layout

列表以连续行和细分隔线组织，页面常规边距 16。动态身份、正文与操作栏使用共享结构；作品列表使用 WorkCard 的图标与摘要，截图放在详情或编辑页。空状态只使用真实业务信息，各空状态通过共享 EmptyState 在所属内容区垂直居中；动态推荐与关注空态不放装饰图片。

标题、分页栏与正文层级稳定，局部加载不推挤已显示内容。安全区、键盘、滚动折叠与横划由共享宿主组件持有，具体规则见交互契约。

## Elevation & Depth

通过画布、surface、细边框和文字对比区分层级，不依赖随机阴影或大面积渐变。覆盖层必须有明确关闭方式；提示不能遮挡关键操作。

## Shapes

像素框架默认直角，轮廓清晰。用户头像统一通过 UserAvatar 显示圆形图片，无头像或加载失败时使用内置 avatar.webp，不用姓名首字占位；抽屉和共享新数据提示使用已有组件的圆角例外；黄色新数据胶囊保持轻量，不扩散为普通卡片样式。

## Components

App 图标使用深紫底、金色五瓣像素紫金花及淡紫花芯，桌面图标、启动页和应用信息共用同一形象；用户默认头像仍使用像素伙伴。

语义颜色、字体、PixelIcon 和共享媒体组件由 packages/ui 与宿主字体适配统一提供。复用已有按钮、确认弹窗、toast、分页、刷新指示器与 NewDataNotice，不为同一能力另造组件。可点击目标至少 44 点；视觉图标可以更小，热区仍需完整。

## Do's and Don'ts

- 用真实状态、计数和权限驱动 UI，文字和动作明确。
- 用语义色适配深浅主题，保留系统字体缩放和可访问标签。
- 优先呈现用户可操作内容，已加载页面静默刷新。
- 不恢复已删除的欢迎卡、朋友栏或旧应用动态模板。
- 不虚构进度百分比、数据、装饰性状态或重复操作入口。
