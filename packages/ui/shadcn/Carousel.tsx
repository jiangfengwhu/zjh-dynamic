import { createContext, useContext, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

type CarouselContextValue = {
  index: number;
  count: number;
  setIndex: (idx: number) => void;
};

const CarouselContext = createContext<CarouselContextValue>({
  index: 0,
  count: 1,
  setIndex: () => {},
});

export type CarouselProps = {
  items?: ReactNode[];
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Carousel({ items, children, style }: CarouselProps) {
  useTheme();
  const [index, setIndex] = useState(0);
  const count = items ? items.length : 1;

  return (
    <CarouselContext.Provider value={{ index, count, setIndex }}>
      <View style={[styles.root, style]}>
        {items ? (
          <View style={styles.slideBox}>
            {items[index]}
            <View style={styles.controls}>
              <CarouselPrevious />
              <CarouselDots />
              <CarouselNext />
            </View>
          </View>
        ) : (
          children
        )}
      </View>
    </CarouselContext.Provider>
  );
}

export function CarouselContent({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return <View style={[styles.slideBox, style]}>{children}</View>;
}

export function CarouselItem({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return <View style={[styles.item, style]}>{children}</View>;
}

export function CarouselPrevious() {
  useTheme();
  const { index, setIndex } = useContext(CarouselContext);
  return (
    <Pressable
      disabled={index <= 0}
      onPress={() => setIndex(Math.max(0, index - 1))}
      style={[styles.navBtn, index <= 0 && styles.disabled]}
    >
      <Text style={styles.navIcon}>‹</Text>
    </Pressable>
  );
}

export function CarouselNext() {
  useTheme();
  const { index, count, setIndex } = useContext(CarouselContext);
  return (
    <Pressable
      disabled={index >= count - 1}
      onPress={() => setIndex(Math.min(count - 1, index + 1))}
      style={[styles.navBtn, index >= count - 1 && styles.disabled]}
    >
      <Text style={styles.navIcon}>›</Text>
    </Pressable>
  );
}

export function CarouselDots() {
  useTheme();
  const { index, count, setIndex } = useContext(CarouselContext);
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }).map((_, i) => (
        <Pressable
          key={i}
          onPress={() => setIndex(i)}
          style={[styles.dot, i === index && styles.dotActive]}
        />
      ))}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  root: {
    gap: 10,
  },
  slideBox: {
    gap: 10,
  },
  item: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    padding: 14,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.35,
  },
  navIcon: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "600",
  },
  dots: {
    flexDirection: "row",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.lineStrong,
  },
  dotActive: {
    width: 14,
    backgroundColor: theme.text,
  },
}));
