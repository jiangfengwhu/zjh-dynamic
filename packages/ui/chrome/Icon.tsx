import { AlignLeft, Sparkles, UserRound, ChevronLeft, ChevronRight, Check, X, Plus, ArrowUp, Square, Pencil, Info, Cpu, Layers, CloudDownload, Clock3, Ellipsis, TriangleAlert, RotateCcw, Sun, Moon } from "lucide-react-native";

export type IconName = "feed" | "workshop" | "mine" | "back" | "chevron" | "check" | "close" | "plus" | "send" | "stop" | "edit" | "info" | "engine" | "box" | "cloud" | "clock" | "more" | "alert" | "restore" | "sun" | "moon";

// Preserve public names while using the host's existing icon family.
const icons = { feed: AlignLeft, workshop: Sparkles, mine: UserRound, back: ChevronLeft, chevron: ChevronRight, check: Check, close: X, plus: Plus, send: ArrowUp, stop: Square, edit: Pencil, info: Info, engine: Cpu, box: Layers, cloud: CloudDownload, clock: Clock3, more: Ellipsis, alert: TriangleAlert, restore: RotateCcw, sun: Sun, moon: Moon };

export function Icon({ name, size = 22, color, strokeWidth = 1.8 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  const Glyph = icons[name];
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} />;
}
