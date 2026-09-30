import { BackChip } from "../../../components/chrome";

export function BackButton({ onPress }: { onPress: () => void }) {
  return <BackChip onPress={onPress} />;
}
