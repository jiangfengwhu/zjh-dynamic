import Svg, { Path } from "react-native-svg";

type GlyphProps = { size?: number; color: string; strokeWidth?: number };

const HEART = "M12 20.5S3.5 15.4 3.5 9.3C3.5 6.6 5.6 4.6 8.1 4.6c1.6 0 3 .8 3.9 2.1.9-1.3 2.3-2.1 3.9-2.1 2.5 0 4.6 2 4.6 4.7 0 6.1-8.5 11.2-8.5 11.2z";
const BUBBLE = "M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-7l-4.2 3.2v-3.2H5A1.5 1.5 0 0 1 3.5 15.5V7A1.5 1.5 0 0 1 5 5.5z";

/** 喜欢。空心是描边，点亮后实心。 */
export function HeartGlyph({ size = 20, color, strokeWidth = 1.8, filled }: GlyphProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={HEART}
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 对 TA 说一句。 */
export function BubbleGlyph({ size = 20, color, strokeWidth = 1.8 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={BUBBLE} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
