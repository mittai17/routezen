import { RefreshCw, TriangleAlert } from "lucide-react-native";
import { Text, View } from "react-native";

import { Button } from "./Button";

export type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

/** Error placeholder with an optional retry action, for failed queries/screens. */
export function ErrorState({
  title = "Something went wrong",
  description = "Please try again. If the problem continues, check your connection.",
  onRetry,
  retryLabel = "Try again",
}: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-8" accessibilityLiveRegion="polite">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-danger/15">
        <TriangleAlert size={28} color="#B3261E" />
      </View>
      <Text className="text-center text-lg font-semibold text-ink" accessibilityRole="header">
        {title}
      </Text>
      <Text className="mt-1 text-center text-sm text-ink-muted">{description}</Text>
      {onRetry ? (
        <Button
          label={retryLabel}
          onPress={onRetry}
          variant="primary"
          className="mt-5"
          icon={<RefreshCw size={16} color="#FFFFFF" />}
        />
      ) : null}
    </View>
  );
}
