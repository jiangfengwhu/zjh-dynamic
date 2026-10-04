import { pixelTheme, usePixelTheme } from "../pixelTheme";
import { useEffect, useState, type ReactNode } from "react";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";
import { PixelIcon } from "../chrome/PixelIcon";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { themedStyleSheet, useTheme } from "../theme";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "destructive";
  actionLabel?: string;
  onAction?: () => void;
};

let listeners: Array<(t: ToastItem) => void> = [];

export const toast = Object.assign(
  (title: string, opts?: Omit<ToastItem, "id" | "title">) => {
    const item: ToastItem = {
      id: `${Date.now()}-${Math.random()}`,
      title,
      ...opts,
    };
    listeners.forEach((fn) => fn(item));
    return item.id;
  },
  {
    success: (title: string, description?: string) =>
      toast(title, { description, variant: "success" }),
    error: (title: string, description?: string) =>
      toast(title, { description, variant: "destructive" }),
    warning: (title: string, description?: string) =>
      toast(title, { description, variant: "warning" }),
  }
);

export function Toaster({ style }: { style?: StyleProp<ViewStyle> }) {
  useTheme();
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const handler = (next: ToastItem) => {
      setItems((prev) => [next, ...prev.slice(0, 2)]);
      const timer = setTimeout(
        () => {
          timers.delete(timer);
          setItems((prev) => prev.filter((x) => x.id !== next.id));
        },
        next.variant === "destructive" ? 6000 : 4200
      );
      timers.add(timer);
    };
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((l) => l !== handler);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <View style={[styles.stack, style]}>
      {items.map((item) => (
        <Toast
          key={item.id}
          title={item.title}
          description={item.description}
          variant={item.variant}
          actionLabel={item.actionLabel}
          onAction={item.onAction}
          onClose={() =>
            setItems((prev) => prev.filter((x) => x.id !== item.id))
          }
        />
      ))}
    </View>
  );
}

export function Toast({
  title,
  description,
  variant = "default",
  actionLabel,
  onAction,
  onClose,
  children,
  style,
}: {
  title?: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "destructive";
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = usePixelTheme();
  const tone =
    variant === "success"
      ? colors.greenText
      : variant === "destructive"
      ? colors.redText
      : variant === "warning"
      ? colors.accentText
      : colors.cyanText;
  const tint =
    variant === "success"
      ? colors.greenTint
      : variant === "destructive"
      ? colors.redTint
      : variant === "warning"
      ? colors.accentTint
      : colors.cyanTint;
  return (
    <Animated.View
      entering={FadeInDown.duration(160).reduceMotion(ReduceMotion.Never)}
      accessibilityLiveRegion={
        variant === "destructive" ? "assertive" : "polite"
      }
      style={[styles.card, style]}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: tint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <PixelIcon
          name={
            variant === "success"
              ? "check"
              : variant === "destructive" || variant === "warning"
              ? "alert"
              : "info"
          }
          size={18}
          color={tone}
        />
      </View>
      <View style={styles.body}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {description ? <Text style={styles.desc}>{description}</Text> : null}
        {children}
      </View>
      {actionLabel ? (
        <Pressable
          accessibilityRole="button"
          disabled={!onAction}
          onPress={onAction}
          style={styles.actionBtn}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭提示"
          onPress={onClose}
          style={styles.closeBtn}
        >
          <PixelIcon name="close" size={14} color={colors.ink3} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

export function ToastTitle({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.title}>{children}</Text>;
}

export function ToastDescription({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.desc}>{children}</Text>;
}

const styles = themedStyleSheet((base) => {
  const t = pixelTheme(base);
  return {
    stack: {
      gap: 8,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 12,
      backgroundColor: t.canvas,
      borderWidth: 0.5,
      borderColor: t.lineStrong,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    title: {
      color: t.ink1,
      fontFamily: t.mono,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "normal",
    },
    desc: {
      color: t.ink3,
      fontFamily: t.mono,
      fontSize: 12,
      lineHeight: 17,
    },
    actionBtn: {
      minHeight: 44,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: t.radius.xs,
      backgroundColor: t.inset,
    },
    actionText: {
      color: t.ink1,
      fontFamily: t.mono,
      fontSize: 11.5,
      fontWeight: "normal",
    },
    closeBtn: {
      width: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    closeText: {
      color: t.ink3,
      fontFamily: t.mono,
      fontSize: 11,
    },
  };
});
