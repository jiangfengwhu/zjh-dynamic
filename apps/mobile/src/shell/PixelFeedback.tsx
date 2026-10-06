import { useEffect, useRef, useState } from "react";
import { ScrollView, View, type AlertButton } from "react-native";
import { Button } from "tamagui";
import { DialogFrame } from "../../../../packages/ui/chrome/DialogFrame";
import { NotificationViewport } from "../../../../packages/ui/feedback/Toasts";
import { setModalFeedbackRenderer } from "../../../../packages/ui/edge";
import { PixelText as Text } from "./feed/PixelText";
import { useTheme } from "../../../../packages/ui/theme";
import { currentPixelAlert, finishPixelAlert, subscribePixelAlerts, type PixelAlertRequest } from "./PixelAlert";

function Confirmation({ request }: { request: PixelAlertRequest }) {
  const { colors } = useTheme();
  const closing = useRef(false);
  const canDismiss = request.options?.cancelable !== false && (request.options?.cancelable === true || request.buttons.some(button => button.style === "cancel"));
  function close(button?: AlertButton) {
    if (closing.current || (!button && !canDismiss)) return;
    closing.current = true;
    finishPixelAlert(request.id, button ?? request.buttons.find(item => item.style === "cancel"));
  }
  const buttons = [...request.buttons].sort((a, b) => Number(b.style === "cancel") - Number(a.style === "cancel"));
  return <DialogFrame open title={request.title} onClose={() => close()} dismissible={canDismiss}>
    <Text accessibilityRole="header" style={{ fontSize: 18, lineHeight: 25 }}>{request.title}</Text>
    {request.message ? <ScrollView style={{ flexShrink: 1 }}><Text style={{ color: colors.ink2, fontSize: 13, lineHeight: 21 }}>{request.message}</Text></ScrollView> : null}
    <View style={{ flexDirection: buttons.length > 2 ? "column" : "row", gap: 8 }}>
      {buttons.map((button,index) => <Button key={index} minHeight={44} flex={buttons.length <= 2 ? 1 : undefined}
        borderRadius={colors.components.controlRadius} fontFamily="$body" fontSize={13}
        backgroundColor={button.style === "cancel" ? colors.inset : button.style === "destructive" ? colors.redTint : colors.accent}
        color={button.style === "cancel" ? colors.ink2 : button.style === "destructive" ? colors.redText : colors.onAccent}
        onPress={() => close(button)}>{button.text || "确认"}</Button>)}
    </View>
  </DialogFrame>;
}
export function PixelFeedback() {
  const [request,setRequest] = useState(currentPixelAlert);
  useEffect(() => {
    const stop = setModalFeedbackRenderer(() => <NotificationViewport modal />);
    const off = subscribePixelAlerts(() => setRequest(currentPixelAlert()));
    setRequest(currentPixelAlert());
    return () => { off(); stop(); };
  },[]);
  return <><NotificationViewport />{request ? <Confirmation key={request.id} request={request} /> : null}</>;
}
