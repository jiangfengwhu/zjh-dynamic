import type { ComponentType } from "react";
import type { AppAvatarProps } from "../../features/avatars/types";

export type FeedKind = "welcome" | "update" | "activity";
export type FeedSlot = FeedKind | "summary";

export type FeedPost = {
  id: string;
  appId: string;
  kind: FeedSlot;
  body: string;
  payload: Record<string, unknown>;
  createdAt: number;
};

/** 一位朋友在动态里的身份：名字、字标、主色，以及可选的自绘头像。 */
export type FeedFriend = {
  id: string;
  name: string;
  mark: string;
  accent: string;
  Avatar?: ComponentType<AppAvatarProps>;
};

/**
 * 朋友登记的卡片组件收到的全部内容。动态是一条时间线，每条像一条推文：
 * 壳只负责条与条之间的分隔线和进场动效，一条里的头像、名字、时间、操作由 kit 里的 PostFrame 排好。
 * 把这些属性原样交给 PostFrame，通过 content 自绘名字与操作栏之间的完整内容区域。
 * 框架不为内容添加白底、边框、圆角或内边距，正文和布局也由 App 决定。
 */
export type FeedCardProps = {
  post: FeedPost;
  friend: FeedFriend;
  /** 类别的中文名：新朋友、更新、近况、小结。 */
  kindLabel: string;
  /** 「3 分钟前」这样的相对时间。 */
  time: string;
  /** 这位朋友还有没看过的新动态。 */
  unread: boolean;
  liked: boolean;
  /** 打开这位朋友的主页。 */
  onOpen: () => void;
  onLike: () => void;
  /** 带着这位朋友的名字去工坊说一句。 */
  onReply: () => void;
};
