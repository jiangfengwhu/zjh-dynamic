import type { UserPost } from "./feed/userPosts";
let handler: (post: UserPost) => Promise<void> = async () => { throw new Error("分享入口尚未就绪"); };
export function setPostSharingHandler(next: typeof handler) { handler = next; }
export function openPostSharing(post: UserPost) { return handler(post); }
