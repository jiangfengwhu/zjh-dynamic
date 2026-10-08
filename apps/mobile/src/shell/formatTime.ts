/** Relative within a week, then a short calendar date; years appear only when they differ. */
export function formatWhen(ms: number, now = Date.now()): string {
  const delta = now - ms;
  if (delta < 60_000) return "刚刚";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`;
  if (delta < 7 * 86_400_000) return `${Math.floor(delta / 86_400_000)} 天前`;
  const date = new Date(ms);
  const day = `${date.getMonth() + 1}月${date.getDate()}日`;
  return date.getFullYear() === new Date(now).getFullYear() ? day : `${date.getFullYear()}年${day}`;
}
