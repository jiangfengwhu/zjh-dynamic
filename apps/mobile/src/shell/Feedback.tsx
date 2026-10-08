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
    ? colors.accentText
    : colors.cyanText;
  const tint = success
    ? colors.greenTint
    : error
    ? colors.redTint
    : warning
    ? colors.accentTint
    : colors.cyanTint;
  return (
    <View
      accessibilityLiveRegion={error ? "assertive" : "polite"}
      style={{
        width: Math.min(width - 32, 420),
        borderRadius: colors.components.dialogRadius,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.lineStrong,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 12,
        shadowColor: colors.ink1,
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: colors.components.controlRadius,
          backgroundColor: tint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SymbolIcon
          name={success ? "check" : error || warning ? "alert" : "info"}
          size={18}
          color={tone}
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
            style={{ color: colors.ink1, fontSize: 15, lineHeight: 22 }}
          >
            {text1}
          </Text>
        ) : null}
        {text2 ? (
          <Text
            numberOfLines={4}
            style={{ color: colors.ink2, fontSize: 13, lineHeight: 20 }}
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
        <SymbolIcon name="close" size={14} color={colors.ink3} />
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
  const tone = danger ? colors.redText : colors.orchidText;
  const tint = danger ? colors.redTint : colors.orchidTint;
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
                backgroundColor: "rgba(25,21,44,0.46)",
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
                backgroundColor: colors.canvas,
                borderRadius: colors.components.dialogRadius,
                borderWidth: 0.5,
                borderColor: colors.lineStrong,
                overflow: "hidden",
                shadowColor: colors.ink1,
                shadowOpacity: 0.2,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 8,
              },
              motion,
            ]}
          >
            <View
              style={{
                height: 4,
                backgroundColor: danger ? colors.red : colors.accent,
              }}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 16,
                paddingBottom: 10,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: colors.components.controlRadius,
                  backgroundColor: tint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SymbolIcon
                  name={danger ? "alert" : "info"}
                  size={20}
                  color={tone}
                />
              </View>
              <Text
                accessibilityRole="header"
                style={{
                  flex: 1,
                  color: colors.ink1,
                  fontSize: 18,
                  lineHeight: 25,
                }}
              >
                {request.title}
              </Text>
            </View>
            {request.message ? (
              <ScrollView
                style={{ flexShrink: 1 }}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingBottom: 14,
                }}
                showsVerticalScrollIndicator={false}
              >
                <Text
                  style={{ color: colors.ink2, fontSize: 13, lineHeight: 21 }}
                >
                  {request.message}
                </Text>
              </ScrollView>
            ) : null}
            <View
              style={{
                padding: 12,
                paddingTop: 4,
                flexDirection: buttons.length > 2 ? "column" : "row",
                gap: 8,
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
                    minHeight: 44,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: colors.components.controlRadius,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor:
                      button.style === "cancel"
                        ? colors.inset
                        : button.style === "destructive"
                        ? colors.redTint
                        : colors.accent,
                    opacity: pressed ? 0.78 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      lineHeight: 19,
                      color:
                        button.style === "cancel"
                          ? colors.ink2
                          : button.style === "destructive"
                          ? colors.redText
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
