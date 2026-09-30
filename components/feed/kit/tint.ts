/** 朋友自己的主色（十六进制）叠上透明度。不是十六进制时退回给定的底色。 */
export function withAlpha(color: string, alpha: number, fallback: string): string {
  const hex = color.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((item) => item + item).join("") : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return fallback;
  const red = parseInt(full.slice(0, 2), 16);
  const green = parseInt(full.slice(2, 4), 16);
  const blue = parseInt(full.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
