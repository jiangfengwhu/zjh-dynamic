import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

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
  },
);

export function Toaster({ style }: { style?: StyleProp<ViewStyle> }) {
  useTheme();
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (next: ToastItem) => {
      setItems((prev) => [next, ...prev.slice(0, 2)]);
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== next.id));
      }, 3500);
    };
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((l) => l !== handler);
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
          onClose={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
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
  return (
    <View style={[styles.card, styles[variant], style]}>
      <View style={styles.body}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {description ? <Text style={styles.desc}>{description}</Text> : null}
        {children}
      </View>
      {actionLabel ? (
        <Pressable onPress={onAction} style={styles.actionBtn}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      {onClose ? (
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      ) : null}
    </View>
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

const styles = themedStyleSheet(() => ({
  stack: {
    gap: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  default: {},
  success: {
    borderColor: theme.green,
  },
  warning: {
    borderColor: theme.orange,
  },
  destructive: {
    borderColor: theme.red,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "600",
  },
  desc: {
    color: theme.muted,
    fontSize: 12,
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.xs,
    backgroundColor: theme.inset,
  },
  actionText: {
    color: theme.text,
    fontSize: 11.5,
    fontWeight: "600",
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    color: theme.muted,
    fontSize: 11,
  },
}));
