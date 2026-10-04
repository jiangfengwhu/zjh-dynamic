import { ActivityIndicator, View } from "react-native";
import { useEffect, useRef } from "react";
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { PixelIcon } from "../../chrome/PixelIcon";
import { Pressy } from "../../chrome";
import { useTheme } from "../../theme";
import { FeedText } from "./FeedPresentation";

export function FeedActionBar({
  liked,
  busy,
  comments,
  likes,
  onComment,
  onLike,
  onShare,
}: {
  liked: boolean;
  busy?: boolean;
  comments?: number;
  likes?: number;
  onComment?: () => void;
  onLike: () => void;
  onShare: () => void;
}) {
  const { colors } = useTheme();
  const action = {
    minHeight: 32,
    minWidth: 44,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
  };
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 1,
      }}
    >
      <Pressy
        accessibilityRole="button"
        accessibilityLabel={`评论 ${comments ?? 0} 条`}
        onPress={onComment}
        hitSlop={{ top: 6, bottom: 6 }}
        style={action}
      >
        <PixelIcon name="chat" size={18} color={colors.ink3} />
        {comments ? (
          <FeedText style={{ fontSize: 12, color: colors.ink3 }}>
            {comments}
          </FeedText>
        ) : null}
      </Pressy>
      <Pressy
        accessibilityRole="button"
        accessibilityLabel={liked ? "取消点赞" : "点赞"}
        accessibilityState={{ selected: liked, disabled: !!busy }}
        disabled={busy}
        onPress={onLike}
        hitSlop={{ top: 6, bottom: 6 }}
        style={action}
      >
        <LikeGlyph liked={liked} busy={!!busy} />
        {likes ? (
          <FeedText
            style={{
              fontSize: 12,
              color: liked ? colors.redText : colors.ink3,
            }}
          >
            {likes}
          </FeedText>
        ) : null}
      </Pressy>
      <Pressy
        accessibilityRole="button"
        accessibilityLabel="分享动态"
        onPress={onShare}
        hitSlop={{ top: 6, bottom: 6 }}
        style={action}
      >
        <PixelIcon name="share" size={18} color={colors.ink3} />
      </Pressy>
    </View>
  );
}

/** Animate the immediate like response, never an initial restored state. */
function LikeGlyph({ liked, busy }: { liked: boolean; busy: boolean }) {
  const { colors } = useTheme();
  const previous = useRef(liked);
  const scale = useSharedValue(1);
  const burst = useSharedValue(1);
  useEffect(() => {
    if (busy) return;
    cancelAnimation(scale);
    cancelAnimation(burst);
    if (liked && !previous.current) {
      scale.value = withSequence(
        ReduceMotion.Never,
        withTiming(0.65, { duration: 70, reduceMotion: ReduceMotion.Never }),
        withSpring(1.25, {
          damping: 12,
          stiffness: 360,
          reduceMotion: ReduceMotion.Never,
        }),
        withSpring(1, {
          damping: 15,
          stiffness: 300,
          reduceMotion: ReduceMotion.Never,
        })
      );
      burst.value = 0;
      burst.value = withTiming(1, {
        duration: 520,
        reduceMotion: ReduceMotion.Never,
      });
    } else {
      scale.value = 1;
      burst.value = 1;
    }
    previous.current = liked;
  }, [liked, busy, scale, burst]);
  useEffect(
    () => () => {
      cancelAnimation(scale);
      cancelAnimation(burst);
    },
    [scale, burst]
  );
  const heart = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const ring = useAnimatedStyle(() => ({
    opacity: (1 - burst.value) * 0.7,
    transform: [{ scale: 0.5 + burst.value * 1.5 }],
  }));
  return (
    <View
      style={{
        width: 18,
        height: 18,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 1.5,
                borderColor: colors.red,
              },
              ring,
            ]}
          />
          {Array.from({ length: 8 }, (_, index) => (
            <LikeParticle
              key={index}
              index={index}
              progress={burst}
              color={[colors.red, colors.orchid, colors.accent][index % 3]}
            />
          ))}
        </>
      }
      <Animated.View style={[heart, busy && { opacity: 0.35 }]}>
        <PixelIcon
          name={liked ? "heart" : "heartOutline"}
          size={18}
          color={liked ? colors.redText : colors.ink3}
        />
      </Animated.View>
      {busy ? (
        <ActivityIndicator
          style={{ position: "absolute" }}
          size="small"
          color={colors.accentText}
        />
      ) : null}
    </View>
  );
}

function LikeParticle({
  index,
  progress,
  color,
}: {
  index: number;
  progress: SharedValue<number>;
  color: string;
}) {
  const angle = (index * Math.PI) / 4;
  const animated = useAnimatedStyle(() => {
    const t = progress.value;
    const distance = 8 + t * 15;
    return {
      opacity: t < 0.04 ? 0 : 1 - t,
      transform: [
        { translateX: Math.cos(angle) * distance },
        { translateY: Math.sin(angle) * distance },
        { scale: 1 - t * 0.65 },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", width: 3, height: 3, backgroundColor: color },
        animated,
      ]}
    />
  );
}
