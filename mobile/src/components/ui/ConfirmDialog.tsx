import { Modal, Pressable, Text, View } from "react-native";

import { Button } from "./Button";

function DestructiveConfirmButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      className="min-h-[44px] flex-row items-center justify-center rounded-pill bg-danger px-5 py-3 active:opacity-80"
    >
      <Text className="text-base font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button as a destructive action (danger background). */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Modal confirm/cancel dialog for destructive or important actions. */
export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute inset-0"
          onPress={onCancel}
        />
        <View
          className="w-full max-w-sm rounded-card bg-surface p-5"
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <Text className="text-lg font-bold text-ink" accessibilityRole="header">
            {title}
          </Text>
          {description ? <Text className="mt-2 text-sm text-ink-muted">{description}</Text> : null}
          <View className="mt-5 flex-row justify-end gap-3">
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              hitSlop={8}
              className="min-h-[44px] items-center justify-center rounded-pill px-4 py-2 active:bg-muted"
            >
              <Text className="text-base font-semibold text-ink-muted">{cancelLabel}</Text>
            </Pressable>
            {destructive ? (
              <DestructiveConfirmButton label={confirmLabel} onPress={onConfirm} />
            ) : (
              <Button label={confirmLabel} onPress={onConfirm} variant="primary" />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
