import { PostFrame, type FeedCardProps } from "../../../../../packages/ui/feed";
import { PixelAvatar } from "./PixelKit";
const bootstrap = require("../../../../../tools/applications/bootstrap.json");

/** Fallback uses the same frame as custom application and user posts. */
export function PixelPostFrame(card: FeedCardProps) {
  const friend =
    card.friend.id === bootstrap.defaultApplication
      ? { ...card.friend, Avatar: PixelAvatar }
      : card.friend;
  return <PostFrame {...card} friend={friend} />;
}
