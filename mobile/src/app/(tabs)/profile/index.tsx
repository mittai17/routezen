import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Eye,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Info,
  MapPin,
  Minus,
  Navigation,
  PackageCheck,
  Plus,
  Repeat,
  Scale,
  Shield,
  Sliders,
  Sparkles,
  Truck,
  User,
  X,
} from "lucide-react-native";

import {
  Button,
  Card,
  ErrorState,
  LoadingSkeleton,
  ScreenHeader,
  StatusBadge,
} from "../../../components/ui";
import {
  DEFAULT_SETTINGS,
  getSettings,
  updateSettings,
  type OptimizationWeights,
  type ScoringWeights,
  type Settings,
} from "../../../lib/api/settings";

const CURRENCIES = ["INR", "USD", "EUR"] as const;

type InfoModalType = "help" | "about" | "privacy" | "terms" | null;

const NOTIFICATIONS_PREF_KEY = "@routezen/pref_notifications";
const ACCESSIBILITY_PREF_KEY = "@routezen/pref_accessibility";

export default function ProfileScreen() {
  const queryClient = useQueryClient();

  // TanStack Query for Settings
  const {
    data: settings,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["settings"],
    queryFn: ({ signal }) => getSettings(signal),
  });

  // Overrides state for settings when user edits
  const [currencyOverride, setCurrencyOverride] = useState<string | null>(null);
  const [roundTripOverride, setRoundTripOverride] = useState<boolean | null>(null);
  const [classicalTimeLimitOverride, setClassicalTimeLimitOverride] = useState<number | null>(null);
  const [scoringWeightsOverride, setScoringWeightsOverride] = useState<ScoringWeights | null>(null);
  const [optimizationWeightsOverride, setOptimizationWeightsOverride] = useState<OptimizationWeights | null>(null);
  const [showAdvancedWeights, setShowAdvancedWeights] = useState<boolean>(false);

  // Active values derived from overrides or loaded settings/defaults
  const currency = currencyOverride ?? settings?.currency ?? "INR";
  const roundTrip = roundTripOverride ?? (settings ? !!settings.round_trip : false);
  const classicalTimeLimit =
    classicalTimeLimitOverride ??
    (typeof settings?.classical_time_limit_s === "number"
      ? settings.classical_time_limit_s
      : 5);
  const scoringWeights =
    scoringWeightsOverride ?? settings?.scoring_weights ?? DEFAULT_SETTINGS.scoring_weights;
  const optimizationWeights =
    optimizationWeightsOverride ??
    settings?.optimization_weights ??
    DEFAULT_SETTINGS.optimization_weights;

  // Mutation for updating settings
  const mutation = useMutation({
    mutationFn: (updated: Partial<Settings>) => updateSettings(updated),
    onSuccess: (saved) => {
      // Clear local overrides once saved to match server
      setCurrencyOverride(null);
      setRoundTripOverride(null);
      setClassicalTimeLimitOverride(null);
      setScoringWeightsOverride(null);
      setOptimizationWeightsOverride(null);
      queryClient.setQueryData(["settings"], saved);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const handleSaveSettings = () => {
    mutation.mutate({
      currency,
      round_trip: roundTrip,
      classical_time_limit_s: classicalTimeLimit,
      scoring_weights: scoringWeights,
      optimization_weights: optimizationWeights,
    });
  };

  // Device preferences (AsyncStorage)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(NOTIFICATIONS_PREF_KEY).then((val) => {
      if (val !== null) setNotificationsEnabled(val === "true");
    });
    AsyncStorage.getItem(ACCESSIBILITY_PREF_KEY).then((val) => {
      if (val !== null) setAccessibilityEnabled(val === "true");
    });
  }, []);

  const toggleNotifications = (val: boolean) => {
    setNotificationsEnabled(val);
    AsyncStorage.setItem(NOTIFICATIONS_PREF_KEY, String(val));
  };

  const toggleAccessibility = (val: boolean) => {
    setAccessibilityEnabled(val);
    AsyncStorage.setItem(ACCESSIBILITY_PREF_KEY, String(val));
  };

  // Informational modals
  const [activeModal, setActiveModal] = useState<InfoModalType>(null);

  // Helper weight increment/decrement
  const updateScoringWeight = (
    key: keyof ScoringWeights,
    delta: number
  ) => {
    const current = scoringWeights[key];
    const updated = Math.max(0, Math.min(1, Math.round((current + delta) * 100) / 100));
    setScoringWeightsOverride({ ...scoringWeights, [key]: updated });
  };

  const updateOptWeight = (
    key: keyof OptimizationWeights,
    delta: number
  ) => {
    const current = optimizationWeights[key];
    const updated = Math.max(0, Math.min(1, Math.round((current + delta) * 100) / 100));
    setOptimizationWeightsOverride({ ...optimizationWeights, [key]: updated });
  };

  const hasUnsavedChanges = settings
    ? currency !== (settings.currency ?? "INR") ||
      roundTrip !== !!settings.round_trip ||
      classicalTimeLimit !== (settings.classical_time_limit_s ?? 5) ||
      JSON.stringify(scoringWeights) !==
        JSON.stringify(settings.scoring_weights ?? DEFAULT_SETTINGS.scoring_weights) ||
      JSON.stringify(optimizationWeights) !==
        JSON.stringify(settings.optimization_weights ?? DEFAULT_SETTINGS.optimization_weights)
    : false;

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        title="Profile"
        subtitle="Account & platform preferences"
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-5 pb-20"
      >
        {/* User profile info card */}
        <Card className="gap-3.5 border-border bg-surface">
          <View className="flex-row items-center gap-3.5">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-green/10">
              <User size={30} color="#0E4429" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-bold text-ink">
                  RouteZen Dispatcher
                </Text>
                <StatusBadge label="Enterprise" tone="success" />
              </View>
              <Text className="text-xs text-ink-muted">
                Ops Workspace: Central Logistics Division
              </Text>
              <Text className="text-xs text-ink-muted">
                dispatch-lead@routezen.internal
              </Text>
            </View>
          </View>
        </Card>

        {/* Settings Section Inline */}
        <View className="gap-2.5">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Sliders size={18} color="#0E4429" />
              <Text className="text-base font-bold text-ink">
                Platform Settings
              </Text>
            </View>
            {hasUnsavedChanges ? (
              <StatusBadge label="Unsaved Changes" tone="warning" />
            ) : null}
          </View>

          {isLoading ? (
            <Card>
              <LoadingSkeleton rows={3} variant="list" />
            </Card>
          ) : isError ? (
            <Card>
              <ErrorState
                title="Could not load settings"
                description="Failed to retrieve platform settings from the server."
                onRetry={() => refetch()}
              />
            </Card>
          ) : (
            <Card className="gap-4 border-border">
              {/* Currency Picker */}
              <View className="gap-2">
                <Text className="text-sm font-semibold text-ink">
                  Operating Currency
                </Text>
                <View className="flex-row gap-2">
                  {CURRENCIES.map((curr) => {
                    const isSelected = currency === curr;
                    return (
                      <Pressable
                        key={curr}
                        onPress={() => setCurrencyOverride(curr)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        className={`flex-1 items-center justify-center rounded-pill border py-2 ${
                          isSelected
                            ? "border-brand-green bg-brand-green"
                            : "border-border bg-surface"
                        }`}
                      >
                        <Text
                          className={`text-sm font-bold ${
                            isSelected ? "text-white" : "text-ink"
                          }`}
                        >
                          {curr}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Round Trip Toggle */}
              <View className="flex-row items-center justify-between border-t border-border/60 pt-3">
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center gap-1.5">
                    <Repeat size={16} color="#0E1A14" />
                    <Text className="text-sm font-semibold text-ink">
                      Round Trip Routing
                    </Text>
                  </View>
                  <Text className="text-xs text-ink-muted">
                    Vehicles return to initial departure depot after the final stop.
                  </Text>
                </View>
                <Switch
                  value={roundTrip}
                  onValueChange={(val) => setRoundTripOverride(val)}
                  trackColor={{ false: "#D1D5DB", true: "#1B6B3F" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Classical Time Limit Stepper */}
              <View className="border-t border-border/60 pt-3 gap-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center gap-1.5">
                      <Clock size={16} color="#0E1A14" />
                      <Text className="text-sm font-semibold text-ink">
                        Classical Solver Timeout
                      </Text>
                    </View>
                    <Text className="text-xs text-ink-muted">
                      Maximum execution budget per optimization run (seconds).
                    </Text>
                  </View>
                  <View className="flex-row items-center rounded-pill border border-border bg-muted/30 px-2 py-1">
                    <Pressable
                      onPress={() =>
                        setClassicalTimeLimitOverride(Math.max(1, classicalTimeLimit - 1))
                      }
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease timeout"
                      className="h-7 w-7 items-center justify-center rounded-full active:bg-muted"
                    >
                      <Minus size={14} color="#0E1A14" />
                    </Pressable>
                    <Text className="mx-2 min-w-[28px] text-center text-sm font-bold text-ink">
                      {classicalTimeLimit}s
                    </Text>
                    <Pressable
                      onPress={() =>
                        setClassicalTimeLimitOverride(Math.min(60, classicalTimeLimit + 1))
                      }
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Increase timeout"
                      className="h-7 w-7 items-center justify-center rounded-full active:bg-muted"
                    >
                      <Plus size={14} color="#0E1A14" />
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Advanced Weights (Expandable Accordion) */}
              <View className="border-t border-border/60 pt-3">
                <Pressable
                  onPress={() => setShowAdvancedWeights(!showAdvancedWeights)}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle advanced optimization weights"
                  className="flex-row items-center justify-between py-1"
                >
                  <View className="flex-row items-center gap-1.5">
                    <Scale size={16} color="#0E4429" />
                    <Text className="text-sm font-bold text-ink">
                      Advanced Objective Weights
                    </Text>
                  </View>
                  {showAdvancedWeights ? (
                    <ChevronUp size={18} color="#5B6B60" />
                  ) : (
                    <ChevronDown size={18} color="#5B6B60" />
                  )}
                </Pressable>

                {showAdvancedWeights ? (
                  <View className="mt-3 gap-4 rounded-xl bg-muted/20 p-3.5">
                    <View className="rounded-card border border-info/30 bg-info/10 p-2.5">
                      <Text className="text-xs text-info font-medium">
                        Weights are normalized server-side to sum to 1.0 before running solver objectives.
                      </Text>
                    </View>

                    {/* Scoring Weights */}
                    <View className="gap-2">
                      <Text className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                        Scoring Weights
                      </Text>
                      {(["cost", "time", "emissions", "utilisation"] as const).map(
                        (k) => (
                          <View
                            key={k}
                            className="flex-row items-center justify-between"
                          >
                            <Text className="text-xs font-semibold capitalize text-ink">
                              {k}
                            </Text>
                            <View className="flex-row items-center gap-2">
                              <Pressable
                                onPress={() => updateScoringWeight(k, -0.05)}
                                hitSlop={6}
                                className="h-6 w-6 items-center justify-center rounded-full border border-border bg-surface active:bg-muted"
                              >
                                <Minus size={12} color="#0E1A14" />
                              </Pressable>
                              <Text className="min-w-[36px] text-center font-mono text-xs font-bold text-ink">
                                {scoringWeights[k].toFixed(2)}
                              </Text>
                              <Pressable
                                onPress={() => updateScoringWeight(k, 0.05)}
                                hitSlop={6}
                                className="h-6 w-6 items-center justify-center rounded-full border border-border bg-surface active:bg-muted"
                              >
                                <Plus size={12} color="#0E1A14" />
                              </Pressable>
                            </View>
                          </View>
                        )
                      )}
                    </View>

                    {/* Optimization Weights */}
                    <View className="gap-2 border-t border-border/40 pt-3">
                      <Text className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                        Optimization Weights
                      </Text>
                      {(["distance", "time", "cost", "emissions"] as const).map(
                        (k) => (
                          <View
                            key={k}
                            className="flex-row items-center justify-between"
                          >
                            <Text className="text-xs font-semibold capitalize text-ink">
                              {k}
                            </Text>
                            <View className="flex-row items-center gap-2">
                              <Pressable
                                onPress={() => updateOptWeight(k, -0.05)}
                                hitSlop={6}
                                className="h-6 w-6 items-center justify-center rounded-full border border-border bg-surface active:bg-muted"
                              >
                                <Minus size={12} color="#0E1A14" />
                              </Pressable>
                              <Text className="min-w-[36px] text-center font-mono text-xs font-bold text-ink">
                                {optimizationWeights[k].toFixed(2)}
                              </Text>
                              <Pressable
                                onPress={() => updateOptWeight(k, 0.05)}
                                hitSlop={6}
                                className="h-6 w-6 items-center justify-center rounded-full border border-border bg-surface active:bg-muted"
                              >
                                <Plus size={12} color="#0E1A14" />
                              </Pressable>
                            </View>
                          </View>
                        )
                      )}
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Save Settings Button */}
              <Button
                label={mutation.isPending ? "Saving..." : "Save Platform Settings"}
                variant="primary"
                loading={mutation.isPending}
                disabled={!hasUnsavedChanges}
                onPress={handleSaveSettings}
                className="mt-2"
              />
            </Card>
          )}
        </View>

        {/* Navigation Rows */}
        <View className="gap-2.5">
          <Text className="text-base font-bold text-ink">
            Workspaces & Modules
          </Text>
          <Card className="gap-1 p-1">
            <NavRow
              icon={<Navigation size={18} color="#0E4429" />}
              title="My Trips"
              subtitle="Personal travel planning & itineraries"
              onPress={() => router.push("/travel")}
            />
            <View className="h-px bg-border/60 mx-3" />
            <NavRow
              icon={<PackageCheck size={18} color="#0E4429" />}
              title="My Deliveries"
              subtitle="Shipments, parcel statuses & delivery slots"
              onPress={() => router.push("/logistics/packages")}
            />
            <View className="h-px bg-border/60 mx-3" />
            <NavRow
              icon={<MapPin size={18} color="#0E4429" />}
              title="Saved Places"
              subtitle="Hubs, depots, delivery stops & warehouses"
              onPress={() => router.push("/profile/places")}
            />
            <View className="h-px bg-border/60 mx-3" />
            <NavRow
              icon={<Truck size={18} color="#0E4429" />}
              title="Vehicle Profiles"
              subtitle="Fleet specifications, capacities & emissions"
              onPress={() => router.push("/logistics/vehicles")}
            />
            <View className="h-px bg-border/60 mx-3" />
            <NavRow
              icon={<FileSpreadsheet size={18} color="#0E4429" />}
              title="Reports & Export"
              subtitle="Download and share CSV operational data"
              onPress={() => router.push("/profile/reports")}
            />
            <View className="h-px bg-border/60 mx-3" />
            <NavRow
              icon={<Sparkles size={18} color="#0E4429" />}
              title="Scenario Comparison"
              subtitle="Run what-if simulations & solver benchmarking"
              onPress={() => router.push("/logistics/scenarios")}
            />
          </Card>
        </View>

        {/* Device Preferences */}
        <View className="gap-2.5">
          <View>
            <Text className="text-base font-bold text-ink">
              Device Preferences
            </Text>
            <Text className="text-xs text-ink-muted">
              (Local to this device / Not synced)
            </Text>
          </View>
          <Card className="gap-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <View className="flex-row items-center gap-2">
                  <Bell size={16} color="#0E1A14" />
                  <Text className="text-sm font-semibold text-ink">
                    Push Notifications
                  </Text>
                </View>
                <Text className="text-xs text-ink-muted">
                  Receive real-time alerts for dispatch completions and status changes.
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: "#D1D5DB", true: "#1B6B3F" }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View className="flex-row items-center justify-between border-t border-border/60 pt-3">
              <View className="flex-1 pr-3">
                <View className="flex-row items-center gap-2">
                  <Eye size={16} color="#0E1A14" />
                  <Text className="text-sm font-semibold text-ink">
                    High Contrast / Accessibility
                  </Text>
                </View>
                <Text className="text-xs text-ink-muted">
                  Enhance contrast levels and outline visibility for field outdoor use.
                </Text>
              </View>
              <Switch
                value={accessibilityEnabled}
                onValueChange={toggleAccessibility}
                trackColor={{ false: "#D1D5DB", true: "#1B6B3F" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </Card>
        </View>

        {/* Informational Section */}
        <View className="gap-2.5">
          <Text className="text-base font-bold text-ink">
            Information & Support
          </Text>
          <Card className="gap-1 p-1">
            <NavRow
              icon={<HelpCircle size={18} color="#5B6B60" />}
              title="Help & Support"
              subtitle="Troubleshooting, FAQs and dispatch operations guide"
              onPress={() => setActiveModal("help")}
            />
            <View className="h-px bg-border/60 mx-3" />
            <NavRow
              icon={<Info size={18} color="#5B6B60" />}
              title="About RouteZen"
              subtitle="Architecture, hybrid quantum/classical solvers & team"
              onPress={() => setActiveModal("about")}
            />
            <View className="h-px bg-border/60 mx-3" />
            <NavRow
              icon={<Shield size={18} color="#5B6B60" />}
              title="Privacy Policy"
              subtitle="Data privacy, telemetry policies & location safeguards"
              onPress={() => setActiveModal("privacy")}
            />
            <View className="h-px bg-border/60 mx-3" />
            <NavRow
              icon={<FileText size={18} color="#5B6B60" />}
              title="Terms of Service"
              subtitle="Usage guidelines, license terms and service limits"
              onPress={() => setActiveModal("terms")}
            />
          </Card>
        </View>

        <Text className="text-center text-xs text-ink-muted mt-2">
          RouteZen Mobile Enterprise · v2.4.0 (Build 2026.10)
        </Text>
      </ScrollView>

      {/* Full Modal for Informational Content */}
      <Modal
        visible={activeModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal(null)}
      >
        <View className="flex-1 bg-surface">
          <View className="flex-row items-center justify-between border-b border-border bg-surface px-4 py-3.5">
            <Text className="text-lg font-bold text-ink">
              {activeModal === "help"
                ? "Help & Support"
                : activeModal === "about"
                ? "About RouteZen"
                : activeModal === "privacy"
                ? "Privacy Policy"
                : "Terms of Service"}
            </Text>
            <Pressable
              onPress={() => setActiveModal(null)}
              accessibilityRole="button"
              accessibilityLabel="Close dialog"
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full bg-muted/50 active:bg-muted"
            >
              <X size={20} color="#0E1A14" />
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerClassName="p-5 gap-4 pb-16"
          >
            {activeModal === "help" && <HelpContent />}
            {activeModal === "about" && <AboutContent />}
            {activeModal === "privacy" && <PrivacyContent />}
            {activeModal === "terms" && <TermsContent />}

            <Button
              label="Close"
              variant="secondary"
              onPress={() => setActiveModal(null)}
              className="mt-6"
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function NavRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      className="flex-row items-center justify-between px-3.5 py-3 active:bg-muted/40 rounded-lg"
    >
      <View className="flex-row items-center gap-3 flex-1 pr-2">
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-muted/40">
          {icon}
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-ink">{title}</Text>
          {subtitle ? (
            <Text className="text-xs text-ink-muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <ChevronRight size={18} color="#5B6B60" />
    </Pressable>
  );
}

/* Rich Informational Copy Components */

function HelpContent() {
  return (
    <View className="gap-4">
      <View className="gap-1.5">
        <Text className="text-base font-bold text-ink">Dispatching & Routing Guide</Text>
        <Text className="text-sm text-ink-muted leading-relaxed">
          RouteZen connects your operational depots, vehicles, and delivery orders with intelligent algorithmic dispatchers.
        </Text>
      </View>

      <Card className="gap-2 bg-muted/20 border-border">
        <Text className="text-sm font-bold text-ink">How to run a dispatch:</Text>
        <Text className="text-xs text-ink leading-relaxed">
          1. Configure your depots and delivery stops under <Text className="font-semibold">Saved Places</Text>.
        </Text>
        <Text className="text-xs text-ink leading-relaxed">
          2. Register vehicles with payload, cubic capacity, and energy profiles in <Text className="font-semibold">Vehicle Profiles</Text>.
        </Text>
        <Text className="text-xs text-ink leading-relaxed">
          3. Enqueue packages in <Text className="font-semibold">My Deliveries</Text> with priority and time windows.
        </Text>
        <Text className="text-xs text-ink leading-relaxed">
          4. Navigate to the Logistics workspace to trigger classical or quantum optimization.
        </Text>
      </Card>

      <View className="gap-1.5">
        <Text className="text-base font-bold text-ink">Frequently Asked Questions</Text>
        <View className="gap-3 mt-1">
          <View className="gap-1">
            <Text className="text-sm font-semibold text-ink">What happens when I am offline?</Text>
            <Text className="text-xs text-ink-muted leading-relaxed">
              RouteZen buffers created package drafts and trip plans in local device storage. When connectivity is restored, drafts can be synced directly to the dispatch server.
            </Text>
          </View>
          <View className="gap-1">
            <Text className="text-sm font-semibold text-ink">How do objective weights affect routing?</Text>
            <Text className="text-xs text-ink-muted leading-relaxed">
              Increasing the emissions weight penalizes fossil-fuel vehicles on longer routes, whereas increasing the cost weight prioritizes cheaper per-kilometer operating profiles.
            </Text>
          </View>
          <View className="gap-1">
            <Text className="text-sm font-semibold text-ink">Need live support?</Text>
            <Text className="text-xs text-ink-muted leading-relaxed">
              Contact our engineering and ops control room at <Text className="font-medium text-brand-green">ops@routezen.internal</Text> or via the telemetry dashboard on the web console.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function AboutContent() {
  return (
    <View className="gap-4">
      <View className="gap-1.5">
        <Text className="text-base font-bold text-ink">RouteZen Platform Architecture</Text>
        <Text className="text-sm text-ink-muted leading-relaxed">
          RouteZen is an enterprise fleet logistics and multi-modal travel optimization platform designed to eliminate empty-mile waste and accelerate sustainable transport operations.
        </Text>
      </View>

      <Card className="gap-2.5 bg-brand-green/5 border-brand-green/20">
        <Text className="text-sm font-bold text-brand-green">Hybrid Solvers</Text>
        <Text className="text-xs text-ink leading-relaxed">
          Our backend engine utilizes a two-tier solver hierarchy:
        </Text>
        <Text className="text-xs text-ink leading-relaxed">
          • <Text className="font-bold">Classical Operations Research:</Text> Fast heuristic TSP/VRP with capacity, time-window constraints (VRPTW), and depot return modeling.
        </Text>
        <Text className="text-xs text-ink leading-relaxed">
          • <Text className="font-bold">Quantum-Inspired QUBO Solvers:</Text> Quadratic unconstrained binary optimization modeled for quantum annealing backends, maximizing vehicle utilization under multi-objective emissions criteria.
        </Text>
      </Card>

      <View className="gap-2">
        <Text className="text-sm font-bold text-ink">Core Capabilities</Text>
        <Text className="text-xs text-ink-muted leading-relaxed">
          • Real-time package tracking with delivery SLA constraints.
        </Text>
        <Text className="text-xs text-ink-muted leading-relaxed">
          • Multi-energy vehicle fleet modeling: Electric (EV), Hydrogen, CNG, and Diesel.
        </Text>
        <Text className="text-xs text-ink-muted leading-relaxed">
          • CSV reporting pipeline and audit logging for enterprise compliance.
        </Text>
        <Text className="text-xs text-ink-muted leading-relaxed">
          • Mobile-first dispatcher and driver field interfaces built on React Native & Expo.
        </Text>
      </View>
    </View>
  );
}

function PrivacyContent() {
  return (
    <View className="gap-4">
      <View className="gap-1.5">
        <Text className="text-base font-bold text-ink">Privacy & Data Governance</Text>
        <Text className="text-sm text-ink-muted leading-relaxed">
          RouteZen treats location telemetry and logistics manifest records with strict enterprise security protocols.
        </Text>
      </View>

      <View className="gap-3">
        <View className="gap-1">
          <Text className="text-sm font-semibold text-ink">1. Geographic Coordinates</Text>
          <Text className="text-xs text-ink-muted leading-relaxed">
            Saved places, depot coordinates, and driver GPS fixes are utilized exclusively for distance matrix calculations and turn-by-turn routing. We do not sell or monetize location streams.
          </Text>
        </View>

        <View className="gap-1">
          <Text className="text-sm font-semibold text-ink">2. Local Storage</Text>
          <Text className="text-xs text-ink-muted leading-relaxed">
            Preferences, contrast settings, and in-flight draft packages are cached locally on your device via AsyncStorage. Clearing the app cache or logging out will flush non-synchronized temporary drafts.
          </Text>
        </View>

        <View className="gap-1">
          <Text className="text-sm font-semibold text-ink">3. Data Retention & Compliance</Text>
          <Text className="text-xs text-ink-muted leading-relaxed">
            Historical route plans and export logs conform to SOC2 and GDPR compliance policies. Exported CSV reports downloaded via the app are written to isolated temporary cache directories.
          </Text>
        </View>
      </View>
    </View>
  );
}

function TermsContent() {
  return (
    <View className="gap-4">
      <View className="gap-1.5">
        <Text className="text-base font-bold text-ink">Terms of Service</Text>
        <Text className="text-sm text-ink-muted leading-relaxed">
          Please review the operational conditions governing your organization&apos;s use of RouteZen dispatch tools.
        </Text>
      </View>

      <View className="gap-3">
        <View className="gap-1">
          <Text className="text-sm font-semibold text-ink">1. Permitted Use</Text>
          <Text className="text-xs text-ink-muted leading-relaxed">
            RouteZen Mobile is licensed for internal enterprise operations, field logistics, package fulfillment, and trip routing. Reverse engineering solver endpoints or automated scraping of optimization APIs is strictly prohibited.
          </Text>
        </View>

        <View className="gap-1">
          <Text className="text-sm font-semibold text-ink">2. Road Safety & Navigation Disclaimer</Text>
          <Text className="text-xs text-ink-muted leading-relaxed">
            Optimized route sequences and waypoint estimates are algorithmic recommendations based on road networks and user-defined constraints. Field drivers must always heed traffic laws, physical road conditions, vehicle gross weight limits, and bridge heights.
          </Text>
        </View>

        <View className="gap-1">
          <Text className="text-sm font-semibold text-ink">3. Service Level Agreement</Text>
          <Text className="text-xs text-ink-muted leading-relaxed">
            High-availability solver clusters aim for 99.9% uptime. Scheduled maintenance windows will be communicated via the Dispatch Admin Console.
          </Text>
        </View>
      </View>
    </View>
  );
}
