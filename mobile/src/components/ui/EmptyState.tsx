import { Inbox } from "lucide-react-native";
import { Text, View } from "react-native";

import { Button } from "./Button";

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

/** Friendly "nothing here yet" placeholder for empty lists/screens. */
export function EmptyState({ title, description, icon, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-muted">
        {icon ?? <Inbox size={28} color="#5B6B60" />}
      </View>
      <Text className="text-center text-lg font-semibold text-ink" accessibilityRole="header">
        {title}
      </Text>
      {description ? (
        <Text className="mt-1 text-center text-sm text-ink-muted">{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="primary" className="mt-5" />
      ) : null}
    </View>
  );
}
