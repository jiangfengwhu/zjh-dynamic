import { Children, createContext, isValidElement, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Keyboard, Modal, StyleSheet, View, type ModalProps, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const EdgeContext = createContext({ bottom: true });

/** 底栏自己占着导航栏时，页面不再重复留底部安全区。 */
export function ScreenEdge({ bottom, children }: { bottom: boolean; children: ReactNode }) {
  const value = useMemo(() => ({ bottom }), [bottom]);
  return <EdgeContext.Provider value={value}>{children}</EdgeContext.Provider>;
}

const BarContext = createContext(0);

/**
 * 页面根容器。背景色画在同一层上，并铺进状态栏和导航栏。
 * 内容自动躲开系统栏。顶部如果放了 ScreenBar，状态栏就用顶栏自己的背景色。
 */
export function Screen({ style, children, ...rest }: ViewProps) {
  const insets = useSafeAreaInsets();
  const edge = useContext(EdgeContext);
  const keyboard = useKeyboardOpen();
  const hasBar = Children.toArray(children).some((child) => isValidElement(child) && (child.type === ScreenBar || Boolean((child.type as { providesBar?: boolean }).providesBar)));
  const paddingTop = hasBar ? 0 : insets.top;
  const paddingBottom = edge.bottom && !keyboard ? insets.bottom : 0;
  return (
    <BarContext.Provider value={insets.top}>
      <View {...rest} collapsable={false} style={[styles.fill, style, { paddingTop, paddingBottom }]}>
        {children}
      </View>
    </BarContext.Provider>
  );
}

/** 贴在页面最上沿的顶栏。它的背景色会铺进状态栏，文字仍留在状态栏下面。 */
export function ScreenBar({ style, children, ...rest }: ViewProps) {
  const top = useContext(BarContext);
  const flat = StyleSheet.flatten(style);
  const inner = typeof flat?.paddingTop === "number"
    ? flat.paddingTop
    : typeof flat?.paddingVertical === "number"
      ? flat.paddingVertical
      : 0;
  return (
    <View {...rest} style={[style, { paddingTop: top + inner }]}>
      {children}
    </View>
  );
}

/** 弹层窗口铺满状态栏和导航栏，遮罩不用每个弹窗再设一次。 */
export function EdgeModal(props: ModalProps) {
  return <Modal {...props} statusBarTranslucent navigationBarTranslucent />;
}

export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
