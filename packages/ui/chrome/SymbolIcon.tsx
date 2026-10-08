import { Search, Plus, Bell, Heart, MessageCircle, ArrowRight, Sparkles, Newspaper, Box, User, Share2, MoreHorizontal, Check, ChevronDown, RefreshCw, TriangleAlert, Image, Layers, ArrowLeft, X, Send, Square, PenLine, Info, Settings, Cloud, Clock, Sun, Moon } from "lucide-react-native";

export type IconSymbol =
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
const symbols = { search: Search, plus: Plus, bell: Bell, heart: Heart, chat: MessageCircle, arrow: ArrowRight, spark: Sparkles, feed: Newspaper, box: Box, mine: User, heartOutline: Heart, share: Share2, more: MoreHorizontal, check: Check, down: ChevronDown, refresh: RefreshCw, alert: TriangleAlert, photo: Image, layers: Layers, back: ArrowLeft, close: X, send: Send, stop: Square, edit: PenLine, info: Info, engine: Settings, cloud: Cloud, clock: Clock, sun: Sun, moon: Moon };
export function SymbolIcon({ name, size = 20, color, strokeWidth = 1.8 }: { name: IconSymbol; size?: number; color: string; strokeWidth?: number }) {
  const Glyph = symbols[name];
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} fill={name === "heart" ? color : "none"} accessible={false} />;
}
