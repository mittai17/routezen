"""Seed demo Chennai locations and vehicle profiles. Idempotent (matched by name).

All vehicle figures are PLANNING ASSUMPTIONS (verification='assumed'), not
measured or manufacturer-verified data. Replace them with your own fleet data.

Usage:  python -m scripts.seed
"""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Location, VehicleProfile
from app.db.session import get_sessionmaker
from app.repositories.base import ensure_workspace

ASSUMED = (
    "Demo data - illustrative planning assumption for Chennai, NOT a verified or measured figure. "
    "Energy prices, mileage and costs are placeholders; replace with your fleet's real data."
)

VEHICLES = [
    dict(name="Electric scooter (demo)", category="two_wheeler", payload_kg=20, volume_m3=0.08, energy_type="electric",
         efficiency_value=40.0, efficiency_unit="km_per_kwh", energy_price="8.00", fixed_cost_per_delivery="12.00",
         operating_cost_per_km="1.00", avg_speed_kmph=25, emissions_g_per_km=0, range_km=70),
    dict(name="Petrol scooter (demo)", category="two_wheeler", payload_kg=20, volume_m3=0.08, energy_type="petrol",
         efficiency_value=45.0, efficiency_unit="km_per_l", energy_price="100.00", fixed_cost_per_delivery="10.00",
         operating_cost_per_km="1.20", avg_speed_kmph=25, emissions_g_per_km=45, range_km=180),
    dict(name="Electric cargo three-wheeler (demo)", category="three_wheeler", payload_kg=500, volume_m3=3.0,
         energy_type="electric", efficiency_value=10.0, efficiency_unit="km_per_kwh", energy_price="8.00",
         fixed_cost_per_delivery="25.00", operating_cost_per_km="2.00", avg_speed_kmph=22, emissions_g_per_km=0,
         range_km=120),
    dict(name="CNG cargo three-wheeler (demo)", category="three_wheeler", payload_kg=500, volume_m3=3.0,
         energy_type="cng", efficiency_value=30.0, efficiency_unit="km_per_l", energy_price="85.00",
         fixed_cost_per_delivery="25.00", operating_cost_per_km="2.50", avg_speed_kmph=22, emissions_g_per_km=80,
         range_km=250),
    dict(name="Diesel mini truck (demo)", category="light_commercial", payload_kg=750, volume_m3=5.0,
         energy_type="diesel", efficiency_value=18.0, efficiency_unit="km_per_l", energy_price="92.00",
         fixed_cost_per_delivery="40.00", operating_cost_per_km="4.00", avg_speed_kmph=25, emissions_g_per_km=150,
         range_km=500),
    dict(name="Electric mini truck (demo)", category="light_commercial", payload_kg=750, volume_m3=5.0,
         energy_type="electric", efficiency_value=5.0, efficiency_unit="km_per_kwh", energy_price="8.00",
         fixed_cost_per_delivery="40.00", operating_cost_per_km="3.00", avg_speed_kmph=25, emissions_g_per_km=0,
         range_km=150),
    dict(name="Diesel delivery van (demo)", category="van", payload_kg=1200, volume_m3=9.0, energy_type="diesel",
         efficiency_value=12.0, efficiency_unit="km_per_l", energy_price="92.00", fixed_cost_per_delivery="60.00",
         operating_cost_per_km="5.50", avg_speed_kmph=28, emissions_g_per_km=210, range_km=600),
]

LOCATIONS = [
    ("RouteZen Depot - Guindy (demo)", 13.0067, 80.2206, "depot", "Guindy"),
    ("T. Nagar (demo)", 13.0418, 80.2341, "stop", "T. Nagar"),
    ("Anna Nagar (demo)", 13.0850, 80.2101, "stop", "Anna Nagar"),
    ("Adyar (demo)", 13.0012, 80.2565, "stop", "Adyar"),
    ("Velachery (demo)", 12.9815, 80.2180, "stop", "Velachery"),
    ("Porur (demo)", 13.0382, 80.1565, "stop", "Porur"),
]


def seed(session: Session, workspace_id: str) -> tuple[int, int]:
    ensure_workspace(session, workspace_id)
    nv = nl = 0
    for spec in VEHICLES:
        exists = session.scalar(select(VehicleProfile.id).where(
            VehicleProfile.workspace_id == workspace_id, VehicleProfile.name == spec["name"]))
        if exists:
            continue
        data = {**spec}
        for k in ("energy_price", "fixed_cost_per_delivery", "operating_cost_per_km"):
            data[k] = Decimal(data[k])
        session.add(VehicleProfile(workspace_id=workspace_id, source=ASSUMED, verification="assumed",
                                   available=True, **data))
        nv += 1
    for name, lat, lng, typ, zone in LOCATIONS:
        if session.scalar(select(Location.id).where(Location.workspace_id == workspace_id, Location.name == name)):
            continue
        session.add(Location(workspace_id=workspace_id, name=name, latitude=lat, longitude=lng, type=typ,
                             zone=zone, address=f"{zone}, Chennai", notes="Demo data"))
        nl += 1
    session.commit()
    return nv, nl


from scripts.seed_all import seed_all

if __name__ == "__main__":
    with get_sessionmaker()() as s:
        v, l = seed(s, get_settings().workspace_id)
        seed_all(s, get_settings().workspace_id)
    print(f"All main data seeded successfully (vehicles, locations, packages, plans, tracking events, scenarios, smart travel).")

