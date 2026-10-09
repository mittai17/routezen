"""Deterministic vehicle recommendation engine (no I/O, no randomness).

Cost model (per package, distance D = billed distance in km):
    fuel vehicle:  energy_L   = D / mileage(km/L);   energy_cost = energy_L * fuel_price
    electric:      energy_kWh = D * kwh_per_km;      energy_cost = energy_kWh * tariff
                   where kwh_per_km = 1 / efficiency(km/kWh)
    operating_cost = D * operating_cost_per_km   (NON-energy costs only: maintenance, driver, wear.
                                                  Energy is never included here -> no double counting)
    variable_cost  = energy_cost + operating_cost
    total_cost     = variable_cost + fixed_cost_per_delivery   (charged once per delivery)

Billed distance equals the one-way depot->package distance, doubled when
`round_trip` is set. The range filter always uses the round-trip distance
(the vehicle must be able to return to the depot).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from app.schemas.recommendation import (
    Ineligible, PackageInput, PackageRecommendation, Preferences, VehicleOption, VehicleSpec,
)

CENT = Decimal("0.01")
RUPEE = "₹"


def _d(x: float | Decimal | int | str) -> Decimal:
    return x if isinstance(x, Decimal) else Decimal(str(x))


def money(x: Decimal) -> Decimal:
    return x.quantize(CENT, rounding=ROUND_HALF_UP)


def energy_for(vehicle: VehicleSpec, distance_km: float) -> tuple[float, Literal["L", "kWh"]]:
    if vehicle.efficiency_unit == "km_per_kwh":
        return distance_km * (1.0 / vehicle.efficiency_value), "kWh"
    return distance_km / vehicle.efficiency_value, "L"


def compute_costs(vehicle: VehicleSpec, billed_km: float) -> dict[str, Decimal | float | str]:
    """Exact cost breakdown. Returned money values are rounded to paise."""
    dist = _d(billed_km)
    if vehicle.efficiency_unit == "km_per_kwh":
        kwh_per_km = Decimal(1) / _d(vehicle.efficiency_value)
        energy = dist * kwh_per_km
        unit = "kWh"
    else:
        energy = dist / _d(vehicle.efficiency_value)
        unit = "L"
    energy_cost = energy * vehicle.energy_price
    operating = dist * vehicle.operating_cost_per_km
    variable = energy_cost + operating
    total = variable + vehicle.fixed_cost_per_delivery
    return {
        "energy_used": float(energy),
        "energy_unit": unit,
        "energy_cost": money(energy_cost),
        "operating_cost": money(operating),
        "variable_cost": money(variable),
        "fixed_cost": money(vehicle.fixed_cost_per_delivery),
        "total_cost": money(total),
        "cost_per_km": money(total / dist) if dist > 0 else money(total),
    }


def _utc(dt: datetime | None) -> datetime:
    return (dt or datetime.now(timezone.utc)).astimezone(timezone.utc)


def recommend(
    package: PackageInput,
    distance_km: float,
    duration_min: float,
    vehicles: list[VehicleSpec],
    prefs: Preferences | None = None,
    distance_source: Literal["osrm", "fallback_estimate", "provided"] = "provided",
    now: datetime | None = None,
) -> PackageRecommendation:
    prefs = prefs or Preferences()
    departure = _utc(prefs.departure_time or now)
    billed_km = distance_km * (2 if prefs.round_trip else 1)
    required_range = distance_km * 2
    fallback = distance_source == "fallback_estimate"

    eligible: list[tuple[VehicleSpec, dict, float, float, datetime, float | None, bool, float]] = []
    ineligible: list[Ineligible] = []

    for v in vehicles:
        reasons: list[str] = []
        if not v.available:
            reasons.append("Vehicle is marked unavailable")
        if package.weight_kg > v.payload_kg:
            reasons.append(f"Package weight {package.weight_kg:g} kg exceeds payload capacity {v.payload_kg:g} kg")
        if package.volume_m3 > v.volume_m3:
            reasons.append(f"Package volume {package.volume_m3:g} m3 exceeds cargo volume {v.volume_m3:g} m3")
        if v.range_km is not None and required_range > v.range_km:
            reasons.append(
                f"Round-trip distance {required_range:.1f} km exceeds vehicle range {v.range_km:g} km"
            )
        travel_min = billed_km / v.avg_speed_kmph * 60
        outbound_min = distance_km / v.avg_speed_kmph * 60  # deadline applies to arrival at customer
        eta = departure + timedelta(minutes=outbound_min)
        slack: float | None = None
        feasible = True
        if package.deadline is not None:
            slack = (package.deadline.astimezone(timezone.utc) - eta).total_seconds() / 60 - package.service_minutes
            feasible = slack >= 0
            if not feasible and prefs.require_deadline:
                reasons.append(
                    f"Cannot meet deadline: needs {outbound_min:.0f} min travel + "
                    f"{package.service_minutes:g} min service, {-slack:.0f} min too late"
                )
        if reasons:
            ineligible.append(Ineligible(vehicle_id=v.vehicle_id, name=v.name, reasons=reasons))
            continue
        costs = compute_costs(v, billed_km)
        emissions = v.emissions_g_per_km * billed_km
        eligible.append((v, costs, travel_min, emissions, eta, slack, feasible, 0.0))

    options = _score(package, eligible, prefs)
    options.sort(key=lambda o: (-o.score, o.total_cost, o.vehicle_id))
    recommended = options[0] if options else None
    alternatives = options[1 : 1 + prefs.top_n] if options else []

    assumptions = [
        "Costs use the vehicle profile's energy price, operating cost per km and fixed delivery charge; "
        "operating cost excludes energy so energy is not double counted.",
        f"Billed distance is {'round trip (2x)' if prefs.round_trip else 'one way'} depot to package.",
        "Range check uses round-trip distance (vehicle must return to the depot).",
        "Travel time = billed distance / vehicle average speed; traffic is not modelled.",
    ]
    if fallback:
        assumptions.append(
            "FALLBACK ESTIMATE: straight-line distance used because road routing was unavailable; "
            "real road distance will be longer."
        )
    unverified = sorted({o.name for o in options if o.verification == "assumed"})
    if unverified:
        assumptions.append("Vehicle specs marked 'assumed' (not verified): " + ", ".join(unverified))

    return PackageRecommendation(
        package_id=package.package_id,
        recommended=recommended,
        alternatives=alternatives,
        ineligible=ineligible,
        distance_km=round(distance_km, 3),
        billed_distance_km=round(billed_km, 3),
        duration_min=round(duration_min, 2),
        distance_source=distance_source,
        fallback_estimate=fallback,
        explanation=_explain(package, recommended, options, ineligible, distance_km, billed_km, fallback),
        assumptions=assumptions,
    )


def _score(package: PackageInput, eligible: list, prefs: Preferences) -> list[VehicleOption]:
    if not eligible:
        return []
    costs = [float(e[1]["total_cost"]) for e in eligible]
    times = [e[2] for e in eligible]
    emis = [e[3] for e in eligible]

    def norm(x: float, xs: list[float]) -> float:
        lo, hi = min(xs), max(xs)
        return 0.0 if hi - lo < 1e-12 else (x - lo) / (hi - lo)

    w = prefs.weights
    wsum = w.cost + w.time + w.emissions + w.utilisation
    out: list[VehicleOption] = []
    for v, c, travel, em, eta, slack, feasible, _ in eligible:
        pu = package.weight_kg / v.payload_kg
        vu = package.volume_m3 / v.volume_m3
        util = max(pu, vu)
        raw = (
            w.cost * (1 - norm(float(c["total_cost"]), costs))
            + w.time * (1 - norm(travel, times))
            + w.emissions * (1 - norm(em, emis))
            + w.utilisation * util
        ) / wsum
        out.append(
            VehicleOption(
                vehicle_id=v.vehicle_id, name=v.name, category=v.category, verification=v.verification,
                energy_used=round(c["energy_used"], 4), energy_unit=c["energy_unit"],
                energy_cost=c["energy_cost"], operating_cost=c["operating_cost"],
                variable_cost=c["variable_cost"], fixed_cost=c["fixed_cost"],
                total_cost=c["total_cost"], cost_per_km=c["cost_per_km"],
                travel_minutes=round(travel, 2), eta=eta,
                deadline_slack_min=None if slack is None else round(slack, 1),
                emissions_g=round(em, 1),
                payload_utilisation=round(pu, 4), volume_utilisation=round(vu, 4),
                deadline_feasible=feasible, score=round(raw * 100, 2),
            )
        )
    return out


def _explain(
    package: PackageInput, rec: VehicleOption | None, options: list[VehicleOption],
    ineligible: list[Ineligible], distance_km: float, billed_km: float, fallback: bool,
) -> str:
    if rec is None:
        if not ineligible:
            return "No vehicles were supplied, so no recommendation can be made."
        reasons = "; ".join(f"{i.name}: {i.reasons[0]}" for i in ineligible[:3])
        return f"No vehicle is eligible for this package ({len(ineligible)} excluded). {reasons}."
    parts = [
        f"{rec.name} is recommended for {distance_km:.1f} km"
        f"{' (round trip billed as %.1f km)' % billed_km if billed_km != distance_km else ''}"
        f"{' (straight-line estimate, road routing unavailable)' if fallback else ''}: "
        f"total {RUPEE}{rec.total_cost} = energy {RUPEE}{rec.energy_cost} ({rec.energy_used:.2f} {rec.energy_unit}) "
        f"+ operating {RUPEE}{rec.operating_cost} + fixed {RUPEE}{rec.fixed_cost}."
    ]
    parts.append(
        f"It uses {rec.payload_utilisation * 100:.0f}% of payload ({package.weight_kg:g} kg) and "
        f"{rec.volume_utilisation * 100:.0f}% of cargo volume, with about {rec.travel_minutes:.0f} min of travel."
    )
    if rec.deadline_slack_min is not None:
        parts.append(
            f"It meets the deadline with {rec.deadline_slack_min:.0f} min to spare."
            if rec.deadline_feasible
            else f"Warning: it misses the deadline by {-rec.deadline_slack_min:.0f} min."
        )
    if len(options) > 1:
        nxt = options[1]
        diff = nxt.total_cost - rec.total_cost
        if diff > 0:
            parts.append(f"It costs {RUPEE}{money(diff)} less than {nxt.name}.")
        elif diff < 0:
            parts.append(
                f"{nxt.name} is {RUPEE}{money(-diff)} cheaper, but {rec.name} scores higher on the weighted "
                f"mix of cost, time, emissions and utilisation."
            )
        else:
            parts.append(f"It costs the same as {nxt.name} but scores higher on time, emissions or utilisation.")
    if ineligible:
        parts.append(f"{len(ineligible)} vehicle(s) were excluded (see ineligible reasons).")
    if rec.verification == "assumed":
        parts.append("Vehicle figures are planning assumptions, not verified measurements.")
    return " ".join(parts)
