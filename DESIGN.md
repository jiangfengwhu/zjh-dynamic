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
    fontFamily: "System, sans-serif"
  utility:
    fontFamily: "Menlo, monospace"
rounded:
  DEFAULT: "0px"
spacing:
  page: "16px"
  card-gap: "14px"
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

主视觉是用户提供的金色墨镜角色；页面像一个有生活气息的像素街区。金色负责主操作，紫色负责空间层级。表达集中在可滚走的角色欢迎区，正文保持阅读效率。奖项品质是持续评审目标，不是可由静态审查证明的结论。

运行时采用 Model B：`apps/mobile/src/shell/feed/pixelTheme.ts` 是动态页语义色唯一所有者，本文件记录该源的设计意图。`packages/ui/theme.ts` 保持 SDK 公共契约；宿主 `ThemeContext` 只在动态页覆盖语义色，`themedStyleSheet` 经 `pixelTheme` 适配。市场、我的和应用自绘内容按后续专项逐步迁移。

## Colors

深色画布、卡片、文字和边框见 frontmatter。浅色映射：画布 `#F1EDF8`、卡片 `#FFFCF5`、正文 `#2E2141`、次要文字 `#705D80`、边框 `#D5C8E5`、强边框 `#8C729F`。金色主操作在两种主题均为 `#F2C665`；浅色文字链接改用 `#765000`。危险与成功角色沿用共享主题语义色。

## Typography

中文正文使用平台无衬线字体，15 / 22；标题 22 / 30、粗体；页标题 24 / 32。时间与数量使用平台等宽字体。像素感来自图形与结构，不把长篇中文变成难辨认的点阵。支持系统字体缩放，不固定正文高度。

## Layout

16 单位页边距、14 单位卡片间距。紧凑顶部与分类随现有滚动逻辑隐藏；欢迎区和朋友栏属于列表内容，不常驻占据屏幕。卡片用自然高度，媒体明确保留宽高比，安全区与底部导航空间沿用宿主计算。

## Elevation & Depth

使用 2 单位实线、4–5 单位底沿／侧沿建立像素厚度。不使用模糊阴影、玻璃层或随机渐变。角色素材原有白底作为头像画框保留，不用抠图改变素材。

## Shapes

控件与头像框方形，选中分类用 16 × 4 的像素短线。SVG 图标采用 16 格网，头像保留角色原始比例。图片正文沿用内容图像，不将照片强行像素化。

## Components

`PixelKit.tsx` 拥有像素图标、角色静态图和唯一视频表面。`PixelPostFrame.tsx` 是宿主默认动态卡，应用登记的卡片仍由应用负责。`FriendRail`、`UserPostCard`、`FeedScreen` 与动态页导航使用统一语义色。业务可点击目标最小 44 单位，选中状态有文字／形状标识。

动画：制作对应常规／近况，工作对应整理／小结，升级对应更新；社区分类用静态头像。提供暂停／播放；减少动态效果时展示静态角色，失焦、后台或离开欢迎区暂停。播放失败保持静态头像，单条卡片异常沿用隔离降级。媒体以生成的 `pixelAssets.ts` 内嵌，视频按内容哈希写入原生缓存；源资源修改后运行 `node scripts/embed-feed-assets.mjs`。

## Do's and Don'ts

- 先保证正文、分类和动作可识别，再增加像素装饰。
- 不虚构活跃人数、等级、奖励或实时状态；页面数量来自现有数据。
- 不修改应用 ID、数据键、vendor 键或应用自定义卡片契约。
- 后续迁移依据同一 token 所有者，不为每个页面另造色板。
