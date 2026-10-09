"""Travel Budget Engine — Transparent, auditable cost calculation for expeditions."""
from __future__ import annotations

import math
from typing import Any


class TravelBudgetEngine:
    def calculate_budget(
        self,
        total_distance_km: float,
        duration_days: int,
        party_size: int = 2,
        target_budget_inr: float | None = 80000.0,
        travel_mode: str = "car",
        meal_budget_per_person: float | None = 400.0,
        max_price_per_night: float | None = 2200.0,
        contingency_pct: float = 10.0,
    ) -> dict[str, Any]:
        nights = max(1, duration_days - 1)
        meals_rate = meal_budget_per_person or 400.0
        nightly_rate = max_price_per_night or 1800.0

        # Fuel calculation (Petrol default: ₹105/L @ 14 km/L)
        if travel_mode == "ev":
            # EV: 0.16 kWh/km @ ₹18/kWh commercial fast charger
            fuel_cost = round(total_distance_km * 0.16 * 18.0)
            fuel_assumption = "EV charging @ ₹18/kWh (0.16 kWh/km)"
        elif travel_mode == "motorcycle":
            fuel_cost = round((total_distance_km / 32.0) * 105.0)
            fuel_assumption = "Motorcycle petrol @ ₹105/L (32 km/L)"
        else:
            fuel_cost = round((total_distance_km / 14.0) * 105.0)
            fuel_assumption = "Car petrol @ ₹105/L (14 km/L highway cruise)"

        # Accommodations (1 room per 2 adults)
        rooms = max(1, math.ceil(party_size / 2.0))
        stay_cost = round(nights * nightly_rate * rooms)

        # Meals
        meal_cost = round(duration_days * meals_rate * party_size)

        # Tolls & Parking (approx ₹1.35 per km on Indian National Expressways)
        tolls_cost = round(total_distance_km * 1.35)
        parking_cost = 1200.0
        attractions_cost = 1600.0

        subtotal = fuel_cost + stay_cost + meal_cost + tolls_cost + parking_cost + attractions_cost
        contingency_cost = round(subtotal * (contingency_pct / 100.0))
        total_cost = subtotal + contingency_cost

        # Day totals
        day_avg = round(total_cost / max(1, duration_days))
        day_totals = [{"day": d + 1, "date": None, "total_inr": day_avg} for d in range(duration_days)]

        return {
            "target_budget_inr": target_budget_inr,
            "estimated_total_inr": total_cost,
            "fuel_inr": fuel_cost,
            "accommodation_inr": stay_cost,
            "meals_inr": meal_cost,
            "attractions_inr": attractions_cost,
            "tolls_inr": tolls_cost,
            "parking_inr": parking_cost,
            "other_inr": 0.0,
            "contingency_inr": contingency_cost,
            "unknown_items": [
                "Fuel efficiency may reduce by 12–15% on high altitude mountain ghats above 3,500m.",
                "Toll fees reflect standard 4-wheeler FASTag rates; subject to state expressway revisions.",
                "Inner line permits (ILP) and green tax fees for restricted border regions not included.",
            ],
            "over_budget": total_cost > (target_budget_inr or 999999),
            "day_totals": day_totals,
            "assumptions": [
                fuel_assumption,
                f"Accommodation: ₹{int(nightly_rate)}/night × {nights} nights × {rooms} room(s)",
                f"Meals: ₹{int(meals_rate)}/person/day × {party_size} travellers × {duration_days} days",
                f"Contingency safety cushion: {contingency_pct}% of total expenditure",
            ],
            "data_source": "routezen_travel_budget_v1",
        }
