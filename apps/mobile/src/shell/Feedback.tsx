import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Easing as NativeEasing,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type AlertButton,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Toast, {
  type ToastConfig,
  type ToastConfigParams,
  type ToastShowParams,
} from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  EdgeModal,
  setModalFeedbackRenderer,
} from "../../../../packages/ui/edge";
import { ThemeContext } from "../../../../packages/ui/theme";
import { HostText as Text } from "./feed/HostText";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
import { useTheme } from "../../../../packages/ui/theme";
import {
  currentHostAlert,
  finishHostAlert,
  subscribeHostAlerts,
  type HostAlertRequest,
} from "./HostAlert";

function FeedbackToast({
  text1,
  text2,
  type,
  onPress,
  hide,
}: ToastConfigParams<unknown>) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const success = type === "success";
  const error = type === "error";
  const warning = type === "warning";
  const tone = success
    ? colors.greenText
    : error
    ? colors.redText
    : warning
    ? colors.orange
    : colors.onDock;
  const tint = success
    ? colors.green
    : error
    ? colors.red
    : warning
    ? "rgba(255,138,61,0.22)"
    : "rgba(255,255,255,0.14)";
  return (
    <View
      accessibilityLiveRegion={error ? "assertive" : "polite"}
      style={{
        width: Math.min(width - 32, 420),
        borderRadius: colors.radius.xl,
        backgroundColor: colors.dock,
        borderWidth: colors.components.surfaceBorder,
        borderColor: colors.dockLine,
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 10,
        paddingRight: 4,
        paddingVertical: 8,
        gap: 12,
        boxShadow: colors.shadow.float,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: tint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SymbolIcon
          name={success ? "check" : error || warning ? "alert" : "info"}
          size={18}
          strokeWidth={2.4}
          color={success || error ? "#FFFFFF" : tone}
        />
      </View>
      <Pressable
        onPress={() => {
          onPress();
          hide();
        }}
        accessibilityRole="button"
        accessibilityLabel={[text1, text2].filter(Boolean).join("，")}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          justifyContent: "center",
          gap: 2,
        }}
      >
        {text1 ? (
          <Text
            numberOfLines={2}
            style={{ color: colors.onDock, fontSize: 15, lineHeight: 21, fontWeight: "700", letterSpacing: -0.2 }}
          >
            {text1}
          </Text>
        ) : null}
        {text2 ? (
          <Text
            numberOfLines={4}
            style={{ color: colors.onDockMuted, fontSize: 13, lineHeight: 19 }}
          >
            {text2}
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        onPress={() => hide()}
        accessibilityRole="button"
        accessibilityLabel="关闭提示"
        style={{
          width: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SymbolIcon name="close" size={15} color={colors.onDockMuted} />
      </Pressable>
    </View>
  );
}
const toastConfig: ToastConfig = {
  success: (props) => <FeedbackToast {...props} />,
  error: (props) => <FeedbackToast {...props} />,
  info: (props) => <FeedbackToast {...props} />,
  warning: (props) => <FeedbackToast {...props} />,
};
export function HostToasts({ modal = false }: { modal?: boolean }) {
  const insets = useSafeAreaInsets();
  const visible = useRef<{ params: ToastShowParams; at: number } | undefined>(undefined);
  useEffect(
    () => () => {
      const message = visible.current;
      if (!modal || !message) return;
      const remaining =
        (message.params.visibilityTime ?? 4200) - (Date.now() - message.at);
      if (message.params.autoHide !== false && remaining <= 0) return;
      requestAnimationFrame(() =>
        Toast.show({
          ...message.params,
          onShow: undefined,
          visibilityTime: Math.max(1000, remaining),
        })
      );
    },
    [modal]
  );
  return (
    <Toast
      onShow={(params) => {
        visible.current = { params, at: Date.now() };
      }}
      onHide={() => {
        visible.current = undefined;
      }}
      config={toastConfig}
      position="top"
      topOffset={insets.top + 8}
      bottomOffset={insets.bottom + 24}
      visibilityTime={4200}
      animationConfig={{
        type: "timing",
        duration: 180,
        easing: NativeEasing.out(NativeEasing.cubic),
      }}
    />
  );
}
function Confirmation({ request }: { request: HostAlertRequest }) {
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const progress = useSharedValue(0);
  const closing = useRef(false);
  const danger = request.buttons.some(
    (button) => button.style === "destructive"
  );
  const tone = danger ? colors.redText : colors.ink1;
  const tint = danger ? colors.redTint : colors.surfaceRaised;
  const canDismiss =
    request.options?.cancelable !== false &&
    (request.options?.cancelable === true ||
      request.buttons.some((button) => button.style === "cancel"));
  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const motion = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }));
  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    AccessibilityInfo.announceForAccessibility(
      [request.title, request.message].filter(Boolean).join("。")
    );
  }, [progress, request]);
  function close(button?: AlertButton) {
    if (closing.current) return;
    if (!button && request.options?.cancelable === false) return;
    if (!button && !request.options?.cancelable) {
      const cancel = request.buttons.find((item) => item.style === "cancel");
      if (!cancel) return;
      button = cancel;
    }
    closing.current = true;
    const finish = () => finishHostAlert(request.id, button);
    progress.value = withTiming(
      0,
      {
        duration: 140,
        easing: Easing.in(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      },
      (finished) => {
        if (finished) runOnJS(finish)();
      }
    );
  }
  // Native default button order is retained, with the cancel action first.
  const buttons = [...request.buttons].sort(
    (a, b) => Number(b.style === "cancel") - Number(a.style === "cancel")
  );
  return (
    <ThemeContext.Provider value={theme}>
      <EdgeModal
        visible
        transparent
        animationType="none"
        onRequestClose={() => close()}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                backgroundColor: colors.mode === "dark" ? "rgba(0,0,0,0.72)" : "rgba(12,12,13,0.42)",
              },
              backdrop,
            ]}
          />
          <Pressable
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
            accessible={canDismiss}
            accessibilityRole="button"
            accessibilityLabel="取消并关闭弹窗"
            onPress={canDismiss ? () => close() : undefined}
          />
          <Animated.View
            accessibilityViewIsModal
            importantForAccessibility="yes"
            style={[
              {
                width: "100%",
                maxWidth: 380,
                maxHeight: Math.max(
                  180,
                  height - insets.top - insets.bottom - 48
                ),
                backgroundColor: colors.surface,
                borderRadius: colors.components.dialogRadius,
                borderWidth: colors.mode === "dark" ? colors.components.surfaceBorder : 0,
                borderColor: colors.line,
                overflow: "hidden",
                boxShadow: colors.shadow.modal,
              },
              motion,
            ]}
          >
            <View
              style={{
                alignItems: "center",
                gap: 14,
                paddingHorizontal: 24,
                paddingTop: 28,
                paddingBottom: 10,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: tint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SymbolIcon
                  name={danger ? "alert" : "info"}
                  size={24}
                  strokeWidth={2}
                  color={tone}
                />
              </View>
              <Text
                accessibilityRole="header"
                style={{
                  color: colors.ink1,
                  ...colors.type.title2,
                  fontSize: 20,
                  lineHeight: 26,
                  textAlign: "center",
                }}
              >
                {request.title}
              </Text>
            </View>
            {request.message ? (
              <ScrollView
                style={{ flexShrink: 1 }}
                contentContainerStyle={{
                  paddingHorizontal: 26,
                  paddingBottom: 18,
                }}
                showsVerticalScrollIndicator={false}
              >
                <Text
                  style={{ color: colors.ink2, fontSize: 15, lineHeight: 23, textAlign: "center" }}
                >
                  {request.message}
                </Text>
              </ScrollView>
            ) : null}
            <View
              style={{
                paddingHorizontal: 20,
                paddingBottom: 20,
                paddingTop: 8,
                flexDirection: buttons.length > 2 ? "column" : "row",
                gap: 10,
              }}
            >
              {buttons.map((button, index) => (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityLabel={button.text || "确认"}
                  onPress={() => close(button)}
                  style={({ pressed }) => ({
                    flex: buttons.length <= 2 ? 1 : undefined,
                    minHeight: 52,
                    paddingHorizontal: 18,
                    paddingVertical: 10,
                    borderRadius: colors.radius.pill,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor:
                      button.style === "cancel"
                        ? colors.surfaceRaised
                        : button.style === "destructive"
                        ? colors.red
                        : colors.accent,
                    opacity: pressed ? 0.78 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      lineHeight: 21,
                      fontWeight: "700",
                      color:
                        button.style === "cancel"
                          ? colors.ink1
                          : button.style === "destructive"
                          ? colors.onDanger
                          : colors.onAccent,
                    }}
                  >
                    {button.text || "确认"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </View>
      </EdgeModal>
    </ThemeContext.Provider>
  );
}
export function Feedback() {
  const [request, setRequest] = useState(currentHostAlert);
  useEffect(() => {
    const stopModalFeedback = setModalFeedbackRenderer(() => (
      <HostToasts modal />
    ));
    const off = subscribeHostAlerts(() => setRequest(currentHostAlert()));
    setRequest(currentHostAlert());
    return () => {
      off();
      stopModalFeedback();
    };
  }, []);
  return (
    <>
      <HostToasts />
      {request ? <Confirmation key={request.id} request={request} /> : null}
    </>
  );
}
