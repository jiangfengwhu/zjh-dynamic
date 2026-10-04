import { PixelAlert as Alert } from "./PixelAlert";

import { useNavigation, usePreventRemove } from "@react-navigation/native";

export function confirmDiscard(action: () => void) {
  Alert.alert("放弃未保存的修改？", "这些修改尚未保存。", [
    { text: "继续编辑", style: "cancel" },
    { text: "放弃修改", style: "destructive", onPress: action },
  ]);
}
export function useDiscardChanges(dirty: boolean) {
  const navigation = useNavigation();
  usePreventRemove(dirty, ({ data }) => confirmDiscard(() => navigation.dispatch(data.action)));
}
