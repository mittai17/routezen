import { useState } from "react";
import { router } from "expo-router";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Sparkles } from "lucide-react-native";

import {
  createScenario,
  SCENARIO_KIND_LABELS,
  type ScenarioInput,
  type ScenarioKind,
} from "../../../../lib/api/scenarios";
import { ApiError } from "../../../../lib/api/client";
import { Button, Card, FormField, ScreenHeader, StatusBadge } from "../../../../components/ui";

const scenarioSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name must be 200 characters or less"),
  description: z.string().trim().max(1000, "Description must be 1000 characters or less").optional(),
  kind: z.enum(["recommendation", "classical", "quantum"]),
  configJson: z
    .string()
    .trim()
    .refine(
      (val) => {
        if (!val) return true;
        try {
          const parsed = JSON.parse(val);
          return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
        } catch {
          return false;
        }
      },
      { message: "Must be a valid JSON object (e.g. {\"key\": \"value\"})" }
    ),
});

type FormValues = z.infer<typeof scenarioSchema>;

const KIND_OPTIONS: ScenarioKind[] = ["recommendation", "classical", "quantum"];

const DEFAULT_CONFIG_HINTS: Record<ScenarioKind, string> = {
  recommendation: '{\n  "mode": "fast",\n  "max_radius_km": 25\n}',
  classical: '{\n  "weights": { "distance": 0.4, "time": 0.3, "cost": 0.2, "emissions": 0.1 },\n  "time_limit_s": 5,\n  "return_to_depot": true\n}',
  quantum: '{\n  "backend": "simulator",\n  "shots": 1024,\n  "max_qubits": 8\n}',
};

export default function NewScenarioScreen() {
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(scenarioSchema),
    defaultValues: {
      name: "",
      description: "",
      kind: "recommendation",
      configJson: "",
    },
  });

  const selectedKind = useWatch({ control, name: "kind" });

  const createMutation = useMutation({
    mutationFn: (input: ScenarioInput) => createScenario(input),
    onSuccess: (newScenario) => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      router.replace(`/logistics/scenarios/${newScenario.id}`);
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to create scenario.";
      setSubmitError(msg);
      Alert.alert("Error Creating Scenario", msg);
    },
  });

  function onSubmit(values: FormValues) {
    setSubmitError(null);
    let parsedConfig: Record<string, unknown> = {};
    if (values.configJson) {
      try {
        parsedConfig = JSON.parse(values.configJson);
      } catch {
        // Handled by zod refinement
        return;
      }
    }

    const payload: ScenarioInput = {
      name: values.name,
      description: values.description?.trim() || null,
      kind: values.kind,
      config: parsedConfig,
    };

    createMutation.mutate(payload);
  }

  function applyPresetConfig() {
    setValue("configJson", DEFAULT_CONFIG_HINTS[selectedKind], { shouldValidate: true });
  }

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
      <ScreenHeader
        title="New Scenario"
        subtitle="Configure simulation or optimization parameters"
        showBack
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {submitError ? (
            <View className="rounded-card border border-danger/30 bg-danger/10 p-3">
              <Text className="text-sm font-medium text-danger">{submitError}</Text>
            </View>
          ) : null}

          {/* Basic Details Card */}
          <Card className="gap-4">
            <Text className="text-sm font-bold uppercase tracking-wider text-ink-muted">
              General Info
            </Text>

            <FormField
              label="Scenario Name"
              required
              error={errors.name?.message}
              helperText="A descriptive identifier for this run"
            >
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Q4 Peak Hour Dispatch"
                    placeholderTextColor="#9AA79F"
                    className={`rounded-xl border bg-surface px-3 py-2.5 text-sm text-ink ${
                      errors.name ? "border-danger" : "border-border"
                    }`}
                  />
                )}
              />
            </FormField>

            <FormField
              label="Description"
              error={errors.description?.message}
              helperText="Optional notes on purpose or variations"
            >
              <Controller
                control={control}
                name="description"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value ?? ""}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Evaluating classical vs recommendation on central depot"
                    placeholderTextColor="#9AA79F"
                    multiline
                    numberOfLines={3}
                    className="min-h-[70px] rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink"
                    style={{ textAlignVertical: "top" }}
                  />
                )}
              />
            </FormField>
          </Card>

          {/* Kind Selector Card */}
          <Card className="gap-3">
            <Text className="text-sm font-bold uppercase tracking-wider text-ink-muted">
              Algorithm / Kind
            </Text>
            <Text className="text-xs text-ink-muted">
              Choose the solver engine. Quantum scenarios can be configured here and explored in the Quantum Lab.
            </Text>

            <Controller
              control={control}
              name="kind"
              render={({ field: { onChange, value } }) => (
                <View className="gap-2 pt-1">
                  {KIND_OPTIONS.map((kind) => {
                    const isSelected = value === kind;
                    return (
                      <Pressable
                        key={kind}
                        onPress={() => onChange(kind)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                        className={`flex-row items-center justify-between rounded-xl border p-3 ${
                          isSelected
                            ? "border-brand-green bg-brand-green/5"
                            : "border-border bg-surface"
                        }`}
                      >
                        <View className="flex-1 pr-2">
                          <Text className="text-sm font-bold text-ink">
                            {SCENARIO_KIND_LABELS[kind]}
                          </Text>
                          <Text className="mt-0.5 text-xs text-ink-muted">
                            {kind === "recommendation"
                              ? "Heuristic vehicle & package match engine"
                              : kind === "classical"
                              ? "Classical OR-Tools VRP route optimization"
                              : "Hybrid quantum solver (Qiskit & simulation)"}
                          </Text>
                        </View>
                        <StatusBadge
                          label={SCENARIO_KIND_LABELS[kind]}
                          tone={
                            kind === "classical"
                              ? "info"
                              : kind === "recommendation"
                              ? "success"
                              : "warning"
                          }
                        />
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />
          </Card>

          {/* Config Card */}
          <Card className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-bold uppercase tracking-wider text-ink-muted">
                Configuration (JSON)
              </Text>
              <Pressable
                onPress={applyPresetConfig}
                className="flex-row items-center gap-1 rounded-pill bg-brand-yellow px-2.5 py-1"
                hitSlop={8}
              >
                <Sparkles size={12} color="#0E1A14" />
                <Text className="text-[11px] font-bold text-ink">Insert Template</Text>
              </Pressable>
            </View>

            <Text className="text-xs text-ink-muted">
              Open parameter dictionary passed directly to the solver. Leave empty ({`{}`}) to use system defaults.
            </Text>

            <FormField
              label=""
              error={errors.configJson?.message}
            >
              <Controller
                control={control}
                name="configJson"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={`{\n  "time_limit_s": 5\n}`}
                    placeholderTextColor="#9AA79F"
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                    className={`min-h-[120px] rounded-xl border bg-surface p-3 font-mono text-xs text-ink ${
                      errors.configJson ? "border-danger" : "border-border"
                    }`}
                    style={{ textAlignVertical: "top" }}
                  />
                )}
              />
            </FormField>
          </Card>

          {/* Form Actions */}
          <View className="flex-row gap-3 pt-2">
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => router.back()}
              disabled={createMutation.isPending}
              className="flex-1"
            />
            <Button
              label="Create Scenario"
              variant="primary"
              onPress={handleSubmit(onSubmit)}
              loading={createMutation.isPending}
              disabled={createMutation.isPending}
              className="flex-1"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
