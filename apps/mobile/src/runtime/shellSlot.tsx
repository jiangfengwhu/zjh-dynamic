import { Text } from "../../../../packages/ui/primitives/Typography";
import { useSyncExternalStore, type ComponentType } from "react";
import { View } from "react-native";

type ShellComponent = ComponentType<Record<string, never>>;

let current: ShellComponent | null = null;
let errorMessage = "";
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function installShell(component: ShellComponent) {
  current = component;
  errorMessage = "";
  console.log("shell installed");
  emit();
}

export function setShellError(message: string) {
  errorMessage = message;
  console.log("shell slot error", message);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function ShellSlot() {
  const shell = useSyncExternalStore(subscribe, () => current);
  const message = useSyncExternalStore(subscribe, () => errorMessage);
  if (message) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text>{message}</Text>
      </View>
    );
  }
  if (!shell) return <View style={{ flex: 1 }} />;
  const Shell = shell;
  return <Shell />;
}
