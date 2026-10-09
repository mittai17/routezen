import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Shows a back chevron that calls `router.back()`, or a custom handler. */
  showBack?: boolean;
  onBack?: () => void;
  /** Right-aligned slot, e.g. an icon button. */
  right?: React.ReactNode;
  /** Apply the device's top safe-area inset as padding. @default true */
  withTopInset?: boolean;
};

/** Shared header: optional back chevron, title (+ optional subtitle), right-side action slot. */
export function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  right,
  withTopInset = true,
}: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <View
      style={{ paddingTop: withTopInset ? insets.top + 8 : 8 }}
      className="flex-row items-center border-b border-border bg-surface px-4 pb-3"
    >
      {showBack ? (
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          className="mr-2 h-11 w-11 items-center justify-center rounded-full active:bg-muted"
        >
          <ChevronLeft size={24} color="#0E1A14" />
        </Pressable>
      ) : null}
      <View className="flex-1">
        <Text className="text-lg font-bold text-ink" accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm text-ink-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View className="ml-2 flex-row items-center gap-2">{right}</View> : null}
    </View>
  );
}
