import { Maximize2, Bookmark, ArrowDown, Search, Plus, Bell, Heart, MessageCircle, ChevronRight, Sparkles, House, LayoutGrid, UserRound, Share, Ellipsis, Check, ChevronDown, RefreshCw, TriangleAlert, ImagePlus, Copy, ChevronLeft, X, ArrowUpRight, Square, PenLine, Info, Cpu, CloudDownload, Clock, Sun, MoonStar } from "lucide-react-native";

export type IconSymbol =
  | "open"
  | "bookmark"
  | "next"
  | "search"
  | "plus"
  | "bell"
  | "heart"
  | "chat"
  | "arrow"
  | "spark"
  | "feed"
  | "box"
  | "mine"
  | "heartOutline"
  | "share"
  | "more"
  | "check"
  | "down"
  | "refresh"
  | "alert"
  | "photo"
  | "layers"
  | "back"
  | "close"
  | "send"
  | "stop"
  | "edit"
  | "info"
  | "engine"
  | "cloud"
  | "clock"
  | "sun"
  | "moon";
const symbols = { open: Maximize2, bookmark: Bookmark, next: ArrowDown, search: Search, plus: Plus, bell: Bell, heart: Heart, chat: MessageCircle, arrow: ChevronRight, spark: Sparkles, feed: House, box: LayoutGrid, mine: UserRound, heartOutline: Heart, share: Share, more: Ellipsis, check: Check, down: ChevronDown, refresh: RefreshCw, alert: TriangleAlert, photo: ImagePlus, layers: Copy, back: ChevronLeft, close: X, send: ArrowUpRight, stop: Square, edit: PenLine, info: Info, engine: Cpu, cloud: CloudDownload, clock: Clock, sun: Sun, moon: MoonStar };
export function SymbolIcon({ name, size = 20, color, strokeWidth = 1.7 }: { name: IconSymbol; size?: number; color: string; strokeWidth?: number }) {
  const Glyph = symbols[name];
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} fill={name === "heart" ? color : "none"} accessible={false} />;
}
