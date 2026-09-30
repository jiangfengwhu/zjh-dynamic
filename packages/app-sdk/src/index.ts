import type { ComponentType } from "react";
import type { AppAvatarProps } from "../../features/avatars/types";
import type { FeedCardProps, FeedTemplates, FeedSlot, FeedPost } from "../../ui/feed/store";
import type { phone } from "../../platform/src/phone";

export type { FeedCardProps, AppAvatarProps };
export type AppDefinition = {
  main: () => ComponentType<Record<string, never>>;
  cards?: FeedTemplates;
  avatar?: ComponentType<AppAvatarProps>;
  onInstall?: (context: AppContext) => void | Promise<void>;
};
export type AppContext = {
  appId: string;
  instanceId: string;
  assets: { uri: (name: string) => string };
  storage: {
    get: (key: string) => string | undefined;
    set: (key: string, value: string) => void;
    subscribe: (key: string, listener: (value: string | undefined) => void) => () => void;
  };
  feed: {
    publish: (post: { kind: FeedSlot; body: string; payload?: Record<string, unknown> }) => void;
    recordChange: (note: string) => void;
    upsert: (post: Omit<FeedPost, "appId">) => void;
    remove: (id: string) => void;
  };
  navigation: { back: () => void; open: () => void; create: (prompt?: string) => void };
  phone: Pick<typeof phone, "vibrate" | "speak" | "notify" | "schedule" | "keepAwake">;
};

/** The application resolver supplies a bound SDK; the host never uses this placeholder. */
export function getAppContext(): AppContext {
  throw new Error("应用 SDK 尚未绑定应用实例");
}
export function defineApp(definition: AppDefinition): AppDefinition {
  return definition;
}
