"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Stepper } from "@/components/ui/stepper";
import { TravelWizardProvider, useTravelWizard } from "@/components/smart-travel/travel-wizard-context";
import { TripSetupStep } from "@/components/smart-travel/step-trip-setup";
import { TravelPreferencesStep } from "@/components/smart-travel/step-preferences";
import { VehicleLogisticsStep } from "@/components/smart-travel/step-vehicle";
import { PrioritiesConstraintsStep } from "@/components/smart-travel/step-priorities";
import { createTrip, saveTripPreferences } from "@/lib/api/travel";
import { Card, CardContent } from "@/components/ui/card";

const STEPS = [
  { title: "Trip Setup", subtitle: "Origin & destination" },
  { title: "Preferences", subtitle: "Pace, budget & food" },
  { title: "Vehicle", subtitle: "Vehicle & fuel" },
  { title: "Constraints", subtitle: "Stops & limits" },
];

function WizardInner() {
  const router = useRouter();
  const { data, step, setStep, setSavedTripId } = useTravelWizard();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      const trip = await createTrip({
        name: data.name || `Trip to ${data.destName}`,
        origin_name: data.originName!,
        origin_lat: data.originLat ?? 0,
        origin_lng: data.originLng ?? 0,
        destination_name: data.destName!,
        destination_lat: data.destLat ?? 0,
        destination_lng: data.destLng ?? 0,
        departure_date: data.departureDate ?? null,
        return_date: data.returnDate ?? null,
        is_one_way: data.isOneWay ?? true,
        adults: data.adults ?? 2,
        children: data.children ?? 0,
        older_travellers: data.olderTravellers ?? 0,
        travel_mode: data.travelMode ?? "car",
        notes: data.tripNotes ?? null,
      });
      await saveTripPreferences(trip.id, {
        pace: data.pace,
        budget_category: data.budgetCategory,
        total_budget_inr: data.totalBudgetInr,
        accommodation_types: data.accommodationTypes,
        max_price_per_night: data.maxPricePerNight,
        food_preference: data.foodPreference,
        interests: data.interests,
        max_drive_hours_per_day: data.maxDriveHoursPerDay,
        max_drive_km_per_day: data.maxDriveKmPerDay,
        avoid_night_driving: data.avoidNightDriving,
        meal_budget_per_person: data.mealBudgetPerPerson,
        contingency_pct: data.contingencyPct,
      });
      setSavedTripId(trip.id);
      router.push(`/smart-travel/${trip.id}/routes`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save trip. Please try again.");
      setSaving(false);
    }
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleFinish();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Step indicator */}
      <Card>
        <CardContent>
          <Stepper steps={STEPS} current={step} maxReached={step} onSelect={i => { if (i <= step) setStep(i); }} />
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Card>
        <CardContent>
          {step === 0 && <TripSetupStep onNext={next} />}
          {step === 1 && <TravelPreferencesStep onNext={next} onBack={() => setStep(0)} />}
          {step === 2 && <VehicleLogisticsStep onNext={next} onBack={() => setStep(1)} />}
          {step === 3 && (
            <PrioritiesConstraintsStep
              onNext={handleFinish}
              onBack={() => setStep(2)}
            />
          )}
        </CardContent>
      </Card>

      {saving && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="rounded-2xl bg-card px-8 py-6 text-center shadow-[var(--shadow-pop)]">
            <div className="mb-3 text-3xl">✈️</div>
            <div className="text-sm font-semibold">Saving your trip&hellip;</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewTravelPage() {
  return (
    <TravelWizardProvider>
      <WizardInner />
    </TravelWizardProvider>
  );
}
