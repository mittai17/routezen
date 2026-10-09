import { useId } from "react";
import { Text, View } from "react-native";

export type FormFieldProps = {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children: React.ReactElement;
};

/**
 * Label + error/helper text wrapper around a single form input (e.g. a
 * `TextInput` wired up with `react-hook-form`'s `Controller`). Wire the
 * returned `nativeID` to the child's `aria-labelledby`/`accessibilityLabel`
 * as needed; screens with inputs should still wrap in
 * `KeyboardAvoidingView`/`ScrollView` themselves since that's a
 * screen-layout concern, not a per-field one.
 */
export function FormField({ label, error, helperText, required = false, children }: FormFieldProps) {
  const labelId = useId();

  return (
    <View className="gap-1.5">
      <Text nativeID={labelId} className="text-sm font-medium text-ink">
        {label}
        {required ? <Text className="text-danger"> *</Text> : null}
      </Text>
      {children}
      {error ? (
        <Text accessibilityRole="alert" className="text-xs font-medium text-danger">
          {error}
        </Text>
      ) : helperText ? (
        <Text className="text-xs text-ink-muted">{helperText}</Text>
      ) : null}
    </View>
  );
}
