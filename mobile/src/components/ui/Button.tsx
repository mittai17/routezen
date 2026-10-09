import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "md" | "lg";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Optional leading icon, e.g. a lucide-react-native icon element. */
  icon?: React.ReactNode;
  /** Optional trailing icon, e.g. an arrow. */
  trailingIcon?: React.ReactNode;
  className?: string;
};

const VARIANT_CLASSES: Record<ButtonVariant, { container: string; text: string; spinner: string }> = {
  primary: {
    container: "bg-brand-green active:bg-brand-green-light",
    text: "text-white",
    spinner: "#FFFFFF",
  },
  secondary: {
    container: "bg-brand-yellow active:bg-brand-yellow-dark",
    text: "text-brand-green",
    spinner: "#0E4429",
  },
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "px-5 py-3",
  lg: "px-6 py-4",
};

/**
 * Primary/secondary action button. Meets the 44x44pt minimum touch target,
 * exposes loading/disabled states, and scales its label with the system
 * font setting (no `allowFontScaling={false}` anywhere).
 */
export function Button({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  trailingIcon,
  className = "",
  onPress,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const colors = VARIANT_CLASSES[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      hitSlop={8}
      className={`min-h-[44px] flex-row items-center justify-center gap-2 rounded-pill ${SIZE_CLASSES[size]} ${colors.container} ${isDisabled ? "opacity-50" : ""} ${className}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.spinner} />
      ) : (
        <>
          {icon}
          <Text className={`text-base font-semibold ${colors.text}`}>{label}</Text>
          {trailingIcon}
        </>
      )}
    </Pressable>
  );
}
