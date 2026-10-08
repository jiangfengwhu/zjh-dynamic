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
import { SymbolIcon } from "../../chrome/SymbolIcon";
import { Pressy } from "../../chrome";
import { useTheme } from "../../theme";
import { FeedText } from "./FeedPresentation";

export function FeedActionBar({
  identity,
  liked,
  busy,
  comments,
  likes,
  views,
  onComment,
  onLike,
  onShare,
}: {
  identity?: string;
  liked: boolean;
  busy?: boolean;
  comments?: number;
  likes?: number;
  views?: number;
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
        <SymbolIcon name="chat" size={18} color={colors.ink3} />
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
        <LikeGlyph identity={identity} liked={liked} busy={!!busy} />
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
      {views !== undefined ? <View accessible accessibilityLabel={`曝光 ${views} 人`} style={action}>
        <View accessible={false} style={{ width: 18, height: 16, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
          {[6, 14, 10].map((height, index) => <View key={index} style={{ width: 3, height, borderRadius: 1, backgroundColor: colors.ink3 }} />)}
        </View>
        <FeedText numberOfLines={1} style={{ fontSize: 12, color: colors.ink3 }}>
          {views >= 10000 ? `${Math.floor(views / 1000) / 10}万` : views >= 1000 ? `${Math.floor(views / 100) / 10}k` : views}
        </FeedText>
      </View> : null}
      <Pressy
        accessibilityRole="button"
        accessibilityLabel="分享动态"
        onPress={onShare}
        hitSlop={{ top: 6, bottom: 6 }}
        style={action}
      >
        <SymbolIcon name="share" size={18} color={colors.ink3} />
      </Pressy>
    </View>
  );
}

/** Animate the immediate like response, never an initial restored state. */
function LikeGlyph({ identity, liked, busy }: { identity?: string; liked: boolean; busy: boolean }) {
  const { colors } = useTheme();
  const previous = useRef(liked);
  const previousIdentity = useRef(identity);
  const scale = useSharedValue(1);
  const burst = useSharedValue(1);
  useEffect(() => {
    if (previousIdentity.current !== identity) { previousIdentity.current = identity; previous.current = liked; cancelAnimation(scale); cancelAnimation(burst); scale.value = 1; burst.value = 1; return; }
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
  }, [identity, liked, busy, scale, burst]);
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
        <SymbolIcon
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
