import { createContext, useContext, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { themedStyleSheet, useTheme } from "../theme";

type CollapsibleContextValue = {
  open: boolean;
  toggle: () => void;
};

const CollapsibleContext = createContext<CollapsibleContextValue>({
  open: false,
  toggle: () => {},
});

export type CollapsibleProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Collapsible({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
  style,
}: CollapsibleProps) {
  useTheme();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen ?? internalOpen;

  const toggle = () => {
    const next = !isOpen;
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <CollapsibleContext.Provider value={{ open: isOpen, toggle }}>
      <View style={[styles.root, style]}>{children}</View>
    </CollapsibleContext.Provider>
  );
}

export function CollapsibleTrigger({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  const { toggle } = useContext(CollapsibleContext);
  return (
    <Pressable onPress={toggle} style={style}>
      {children}
    </Pressable>
  );
}

export function CollapsibleContent({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  const { open } = useContext(CollapsibleContext);
  if (!open) return null;
  return <View style={style}>{children}</View>;
}

const styles = themedStyleSheet(() => ({
  root: {
    gap: 6,
  },
}));
