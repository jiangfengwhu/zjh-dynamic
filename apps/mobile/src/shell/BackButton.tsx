import { BackChip } from "../../../../packages/ui/chrome";

export function BackButton({ onPress }: { onPress: () => void }) {
  return <BackChip onPress={onPress} />;
}
