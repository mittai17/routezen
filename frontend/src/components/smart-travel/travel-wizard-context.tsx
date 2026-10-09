"use client";
/**
 * TravelWizardContext — persists trip setup state across all 4 wizard steps
 * without requiring a backend round-trip between each step.
 */
import React, { createContext, useContext, useState, useCallback } from "react";

export interface WizardTripData {
  // Step 1 — Trip Setup
  name?: string;
  originName?: string;
  originLat?: number;
  originLng?: number;
  destName?: string;
  destLat?: number;
  destLng?: number;
  departureDate?: string;
  returnDate?: string;
  isOneWay?: boolean;
  adults?: number;
  children?: number;
  olderTravellers?: number;
  travelMode?: string;
  vehicleProfileId?: string;

  // Step 2 — Preferences
  pace?: string;
  budgetCategory?: string;
  totalBudgetInr?: number;
  accommodationTypes?: string[];
  maxPricePerNight?: number;
  foodPreference?: string;
  interests?: string[];
  maxDriveHoursPerDay?: number;
  maxDriveKmPerDay?: number;
  avoidNightDriving?: boolean;
  mealBudgetPerPerson?: number;

  // Step 3 — Vehicle
  vehicleCategory?: string;
  fuelType?: string;
  mileageKmpl?: number;
  kwhPerKm?: number;
  fuelPricePerL?: number;
  electricityTariff?: number;
  tankCapacityL?: number;
  batteryRangeKm?: number;

  // Step 4 — Constraints
  mandatoryCheckpoints?: string[];
  avoidList?: string[];
  maxAccommodationPerNight?: number;
  activityBudget?: number;
  contingencyPct?: number;
  tripNotes?: string;
}

interface TravelWizardCtx {
  data: WizardTripData;
  set: (patch: Partial<WizardTripData>) => void;
  reset: () => void;
  step: number;
  setStep: (s: number) => void;
  savedTripId?: string;
  setSavedTripId: (id: string) => void;
}

const Ctx = createContext<TravelWizardCtx | null>(null);

export function TravelWizardProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<WizardTripData>({
    adults: 2,
    children: 0,
    olderTravellers: 0,
    travelMode: "car",
    isOneWay: true,
    pace: "balanced",
    budgetCategory: "mid_range",
    accommodationTypes: ["mid_hotel"],
    foodPreference: "any",
    interests: [],
    maxDriveHoursPerDay: 8,
    avoidNightDriving: true,
    contingencyPct: 10,
    mandatoryCheckpoints: [],
    avoidList: [],
  });
  const [step, setStep] = useState(0);
  const [savedTripId, setSavedTripId] = useState<string | undefined>();

  const set = useCallback((patch: Partial<WizardTripData>) => {
    setData(prev => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setData({ adults: 2, children: 0, olderTravellers: 0, travelMode: "car", isOneWay: true, pace: "balanced", budgetCategory: "mid_range", accommodationTypes: ["mid_hotel"], foodPreference: "any", interests: [], maxDriveHoursPerDay: 8, avoidNightDriving: true, contingencyPct: 10, mandatoryCheckpoints: [], avoidList: [] });
    setStep(0);
    setSavedTripId(undefined);
  }, []);

  return (
    <Ctx.Provider value={{ data, set, reset, step, setStep, savedTripId, setSavedTripId }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTravelWizard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTravelWizard must be used inside TravelWizardProvider");
  return ctx;
}
