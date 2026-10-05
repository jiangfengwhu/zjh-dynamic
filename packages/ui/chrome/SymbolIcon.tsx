import { Search, Plus, Bell, Heart, MessageCircle, ArrowRight, Sparkles, Newspaper, Box, User, Share2, MoreHorizontal, Check, ChevronDown, RefreshCw, TriangleAlert, Image, Layers, ArrowLeft, X, Send, Square, PenLine, Info, Settings, Cloud, Clock, Sun, Moon } from "lucide-react-native";
import { useTheme } from "../theme";
import Svg, { Path } from "react-native-svg";

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
const paths: Record<IconSymbol, string> = {
  search:
    "M3 1h7v2h2v7h-2v2H3v-2H1V3h2zM3 3v7h7V3zM10 10h2v2h2v2h2v2h-3v-2h-2v-2H9z",
  heartOutline:
    "M2 3h4v2h4V3h4v2h2v5h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V5h2zM2 5v5h2v2h2v2h4v-2h2v-2h2V5h-2v2H4V5z",
  share: "M9 1h2v2h2v2h2v2h-2v2h-2v2H9V8H6v2H4v3h10v2H2V8h2V6h5z",
  more: "M1 7h3v3H1zM6 7h3v3H6zM11 7h3v3h-3z",
  check: "M12 3h2v3h-2v2h-2v2H8v2H6v2H4v-2H2v-2H0V8h2v2h2v2h2v-2h2V8h2V6h2z",
  down: "M7 1h2v8h3v2h-2v2H8v2H6v-2H4v-2H2V9h5z",
  refresh:
    "M4 1h7v2h2V1h2v6H9V5h2V3H5v2H3v6h2v2h6v-2h2v2h-2v2H4v-2H2v-2H0V5h2V3h2z",
  alert: "M7 0h2v2h2v3h2v3h2v3h1v4H0v-4h1V8h2V5h2V2h2zM7 5v5h2V5zM7 12v2h2v-2z",
  photo:
    "M1 2h11v2H3v9h10V9h2v6H1zM5 5h2v2H5zM4 10h2V8h2v2h2v2H4zM12 1h2v3h2v2h-2v2h-2V6h-2V4h2z",
  layers:
    "M6 1h4v2h4v2h2v2h-2v2h-4v2H6V9H2V7H0V5h2V3h4zM4 5v2h8V5zM0 10h2v2h4v2h4v-2h4v-2h2v3h-2v2h-4v1H6v-1H2v-2H0z",
  back: "M9 1h2v2H9v2H7v2H5v2h2v2h2v2h2v2H9v-2H7v-2H5V9H3V7h2V5h2V3h2z",
  close:
    "M2 2h2v2h2v2h4V4h2V2h2v2h-2v2h-2v4h2v2h2v2h-2v-2h-2v-2H6v2H4v2H2v-2h2v-2h2V6H4V4H2z",
  send: "M7 1h2v2h2v2h2v2h2v2h-4V7H9v8H7V7H5v2H1V7h2V5h2V3h2z",
  stop: "M3 3h10v10H3z",
  edit: "M11 1h2v2h2v2h-2v2h-2v2H9v2H7v2H3v2H1v-4h2V9h2V7h2V5h2V3h2zM3 11v2h2v-2z",
  info: "M4 1h8v2h2v2h2v6h-2v2h-2v2H4v-2H2v-2H0V5h2V3h2zM7 4v2h2V4zM6 8v2h1v2h3v-2H9V8z",
  engine:
    "M4 1h2v2h4V1h2v2h2v2h2v2h-2v2h2v2h-2v2h-2v2h-2v-2H6v2H4v-2H2v-2H0V9h2V7H0V5h2V3h2zM4 5v6h8V5zM6 7h4v2H6z",
  cloud:
    "M5 2h6v2h2v2h2v2h1v5h-5v-2h3V8h-3V5H5v2H2v4h3v2H0V7h2V5h3zM7 8h2v4h2v2H9v2H7v-2H5v-2h2z",
  clock:
    "M4 1h8v2h2v2h2v6h-2v2h-2v2H4v-2H2v-2H0V5h2V3h2zM4 3v2H2v6h2v2h8v-2h2V5h-2V3zM7 4h2v4h3v2H7z",
  sun: "M7 0h2v3H7zM7 13h2v3H7zM0 7h3v2H0zM13 7h3v2h-3zM2 2h2v2H2zM12 2h2v2h-2zM2 12h2v2H2zM12 12h2v2h-2zM5 4h6v2h1v5h-2v1H5v-2H4V6h1z",
  moon: "M6 1h4v2H6v6h2v2h6v-1h2v3h-2v2H6v-2H3v-2H1V5h2V3h3z",
  plus: "M7 2h2v5h5v2H9v5H7V9H2V7h5z",
  bell: "M6 1h4v2h2v2h1v6h2v2H1v-2h2V5h1V3h2zM5 5v6h6V5H9V3H7v2zM6 14h4v2H6z",
  heart: "M2 3h4v2h4V3h4v2h2v5h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V5h2z",
  chat: "M1 2h14v10H7l-4 3v-3H1zM3 4v6h2v2l2-2h6V4z",
  arrow: "M8 1h2v2h2v2h2v2h2v2h-2v2h-2v2h-2v2H8v-4h2V9H0V7h10V5H8z",
  spark: "M7 0h2v5h2v2h5v2h-5v2H9v5H7v-5H5V9H0V7h5V5h2z",
  feed: "M1 1h14v14H1zM3 3v10h10V3zM5 5h6v2H5zM5 9h4v2H5z",
  box: "M2 2h12v3h2v10H0V5h2zM4 4v2h8V4zM2 8v5h12V8h-4v2H6V8z",
  mine: "M5 1h6v2h2v6h-2v2h3v2h2v3H0v-3h2v-2h3V9H3V3h2zM5 3v6h6V3zM4 13v1h8v-1z",
};
function PixelGlyph({
  name,
  size = 20,
  color,
}: {
  name: IconSymbol;
  size?: number;
  color: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" accessible={false}>
      <Path d={paths[name]} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

const symbols = { search: Search, plus: Plus, bell: Bell, heart: Heart, chat: MessageCircle, arrow: ArrowRight, spark: Sparkles, feed: Newspaper, box: Box, mine: User, heartOutline: Heart, share: Share2, more: MoreHorizontal, check: Check, down: ChevronDown, refresh: RefreshCw, alert: TriangleAlert, photo: Image, layers: Layers, back: ArrowLeft, close: X, send: Send, stop: Square, edit: PenLine, info: Info, engine: Settings, cloud: Cloud, clock: Clock, sun: Sun, moon: Moon };
export function SymbolIcon({ name, size = 20, color, strokeWidth = 1.8 }: { name: IconSymbol; size?: number; color: string; strokeWidth?: number }) {
  const { skin } = useTheme();
  if (skin === "pixel-street") return <PixelGlyph name={name} size={size} color={color} />;
  const Glyph = symbols[name];
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} fill={name === "heart" ? color : "none"} accessible={false} />;
}
