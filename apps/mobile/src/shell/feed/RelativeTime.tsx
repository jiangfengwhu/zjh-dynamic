import { memo, useCallback, useSyncExternalStore } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { formatWhen } from '../formatTime';
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) timer = setInterval(() => listeners.forEach(notify => notify()), 60000);
  return () => { listeners.delete(listener); if (!listeners.size && timer) { clearInterval(timer); timer = undefined; } };
}
const inactive = () => () => {};
export const RelativeTime = memo(function RelativeTime({ at }: { at: number }) {
  const focused = useIsFocused();
  const snapshot = useCallback(() => formatWhen(at), [at]);
  const time = useSyncExternalStore(focused ? subscribe : inactive, snapshot, snapshot);
  return <>{time}</>;
});
