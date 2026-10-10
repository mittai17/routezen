"""Comprehensive seed script for RouteZen.
Seeds:
- Workspaces
- Chennai Locations (13 depots and stops)
- Vehicle Profiles (7 verified powertrains with INR paise accounting)
- Packages (14 commercial & residential packages across Chennai)
- Delivery Plans & Assignments (dispatched, completed, and draft plans)
- Delivery Events (live dispatch tracking events)
- Scenarios (pre-computed recommendation, classical OR-Tools, and quantum hybrid)
- Smart Travel (full trips, checkpoints, route options, places, itinerary days, preferences)

Usage:
    python -m scripts.seed_all
"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import (
    Workspace, Location, VehicleProfile, Package, DeliveryPlan,
    PlanAssignment, DeliveryEvent, Scenario, Setting
)
from app.db.travel_models import (
    TravelTrip, TravelPreferences, TravelCheckpoint, TravelRouteOption,
    TravelPlace, TravelItineraryDay
)
from app.db.session import get_sessionmaker
from app.repositories.base import ensure_workspace

ASSUMED = (
    "Demo data - illustrative planning assumption for Chennai, NOT a verified or measured figure. "
    "Energy prices, mileage and costs are placeholders; replace with your fleet's real data."
)

LOCATIONS_DATA = [
    ("loc-depot-central", "Depot (Chennai Central)", 13.0827, 80.2757, "depot", "Central", "Chennai Central, Park Town, Chennai"),
    ("loc-depot-guindy", "RouteZen Depot - Guindy (demo)", 13.0067, 80.2206, "depot", "South-West", "Guindy Industrial Estate, Chennai"),
    ("loc-tnagar", "T. Nagar (demo)", 13.0418, 80.2341, "stop", "Central", "Pondy Bazaar, T. Nagar, Chennai"),
    ("loc-anna", "Anna Nagar (demo)", 13.0850, 80.2101, "stop", "North-West", "2nd Avenue, Anna Nagar, Chennai"),
    ("loc-adyar", "Adyar (demo)", 13.0012, 80.2565, "stop", "South", "Gandhi Nagar, Adyar, Chennai"),
    ("loc-velachery", "Velachery (demo)", 12.9815, 80.2180, "stop", "South", "100 Feet Road, Velachery, Chennai"),
    ("loc-porur", "Porur (demo)", 13.0382, 80.1565, "stop", "West", "Mount-Poonamallee Road, Porur, Chennai"),
    ("loc-mogappair", "Mogappair (demo)", 13.0875, 80.1700, "stop", "North-West", "Mogappair West, Chennai"),
    ("loc-besant", "Besant Nagar (demo)", 13.0002, 80.2668, "stop", "South", "Elliot's Beach Road, Besant Nagar, Chennai"),
    ("loc-sholinganallur", "Sholinganallur (demo)", 12.9010, 80.2279, "stop", "OMR", "OMR IT Corridor, Sholinganallur, Chennai"),
    ("loc-thiruvanmiyur", "Thiruvanmiyur (demo)", 12.9830, 80.2594, "stop", "South", "East Coast Road Junction, Thiruvanmiyur, Chennai"),
    ("loc-marina", "Marina Beach (demo)", 13.0500, 80.2824, "stop", "East", "Kamarajar Promenade, Marina, Chennai"),
    ("loc-airport", "Chennai International Airport (demo)", 12.9941, 80.1709, "stop", "South-West", "GST Road, Meenambakkam, Chennai"),
]

VEHICLES_DATA = [
    dict(id="veh-elec-scooter", name="Electric scooter (demo)", category="two_wheeler", payload_kg=20, volume_m3=0.08, energy_type="electric",
         efficiency_value=40.0, efficiency_unit="km_per_kwh", energy_price="8.00", fixed_cost_per_delivery="12.00",
         operating_cost_per_km="1.00", avg_speed_kmph=25, emissions_g_per_km=0, range_km=70),
    dict(id="veh-petrol-scooter", name="Petrol scooter (demo)", category="two_wheeler", payload_kg=20, volume_m3=0.08, energy_type="petrol",
         efficiency_value=45.0, efficiency_unit="km_per_l", energy_price="100.00", fixed_cost_per_delivery="10.00",
         operating_cost_per_km="1.20", avg_speed_kmph=25, emissions_g_per_km=45, range_km=180),
    dict(id="veh-elec-3w", name="Electric cargo three-wheeler (demo)", category="three_wheeler", payload_kg=500, volume_m3=3.0,
         energy_type="electric", efficiency_value=10.0, efficiency_unit="km_per_kwh", energy_price="8.00",
         fixed_cost_per_delivery="25.00", operating_cost_per_km="2.00", avg_speed_kmph=22, emissions_g_per_km=0,
         range_km=120),
    dict(id="veh-cng-3w", name="CNG cargo three-wheeler (demo)", category="three_wheeler", payload_kg=500, volume_m3=3.0,
         energy_type="cng", efficiency_value=30.0, efficiency_unit="km_per_l", energy_price="85.00",
         fixed_cost_per_delivery="25.00", operating_cost_per_km="2.50", avg_speed_kmph=22, emissions_g_per_km=80,
         range_km=250),
    dict(id="veh-diesel-minitruck", name="Diesel mini truck (demo)", category="light_commercial", payload_kg=750, volume_m3=5.0,
         energy_type="diesel", efficiency_value=18.0, efficiency_unit="km_per_l", energy_price="92.00",
         fixed_cost_per_delivery="40.00", operating_cost_per_km="4.00", avg_speed_kmph=25, emissions_g_per_km=150,
         range_km=500),
    dict(id="veh-elec-minitruck", name="Electric mini truck (demo)", category="light_commercial", payload_kg=750, volume_m3=5.0,
         energy_type="electric", efficiency_value=5.0, efficiency_unit="km_per_kwh", energy_price="8.00",
         fixed_cost_per_delivery="40.00", operating_cost_per_km="3.00", avg_speed_kmph=25, emissions_g_per_km=0,
         range_km=150),
    dict(id="veh-diesel-van", name="Diesel delivery van (demo)", category="van", payload_kg=1200, volume_m3=9.0, energy_type="diesel",
         efficiency_value=12.0, efficiency_unit="km_per_l", energy_price="92.00", fixed_cost_per_delivery="60.00",
         operating_cost_per_km="5.50", avg_speed_kmph=28, emissions_g_per_km=210, range_km=600),
]

PACKAGES_DATA = [
    dict(ref="RZ-1001", recipient="Anna Nagar Medicals", loc_key="Anna Nagar (demo)",
         weight=6.0, length=30, width=20, height=15, priority="medium", handling=["temperature_sensitive"], status="in_transit"),
    dict(ref="RZ-1002", recipient="Mogappair Retailers", loc_key="Mogappair (demo)",
         weight=3.0, length=25, width=15, height=10, priority="low", handling=[], status="pending"),
    dict(ref="RZ-1003", recipient="Porur Electronics & Components", loc_key="Porur (demo)",
         weight=25.0, length=50, width=40, height=30, priority="high", handling=["fragile"], status="assigned"),
    dict(ref="RZ-1004", recipient="T. Nagar Silk & Textiles", loc_key="T. Nagar (demo)",
         weight=18.0, length=45, width=35, height=25, priority="high", handling=["keep_upright"], status="delivered"),
    dict(ref="RZ-1005", recipient="Adyar Academic Books", loc_key="Adyar (demo)",
         weight=4.0, length=30, width=22, height=12, priority="low", handling=[], status="delivered"),
    dict(ref="RZ-1006", recipient="Velachery Organic Market", loc_key="Velachery (demo)",
         weight=10.0, length=35, width=25, height=20, priority="medium", handling=["fragile"], status="in_transit"),
    dict(ref="RZ-1007", recipient="Besant Cafe Supplies", loc_key="Besant Nagar (demo)",
         weight=5.0, length=28, width=20, height=18, priority="low", handling=[], status="assigned"),
    dict(ref="RZ-1008", recipient="Sholinganallur Cloud Data Hub", loc_key="Sholinganallur (demo)",
         weight=22.0, length=60, width=40, height=25, priority="high", handling=["fragile", "security_seal"], status="assigned"),
    dict(ref="RZ-1009", recipient="Thiruvanmiyur Artisan Roasters", loc_key="Thiruvanmiyur (demo)",
         weight=8.0, length=30, width=25, height=20, priority="medium", handling=[], status="pending"),
    dict(ref="RZ-1010", recipient="Marina Beach Tourism Kiosk", loc_key="Marina Beach (demo)",
         weight=12.0, length=40, width=30, height=20, priority="low", handling=[], status="pending"),
    dict(ref="RZ-1011", recipient="Airport Air Freight Logistics", loc_key="Chennai International Airport (demo)",
         weight=35.0, length=70, width=50, height=35, priority="high", handling=["urgent"], status="pending"),
    dict(ref="RZ-1012", recipient="Guindy Precision Tool Works", loc_key="RouteZen Depot - Guindy (demo)",
         weight=15.0, length=40, width=30, height=25, priority="medium", handling=["heavy"], status="pending"),
    dict(ref="RZ-1013", recipient="Chennai Central Rapid Express", loc_key="Depot (Chennai Central)",
         weight=7.5, length=32, width=24, height=16, priority="high", handling=["fragile"], status="pending"),
    dict(ref="RZ-1014", recipient="Anna Nagar Diagnostics & Labs", loc_key="Anna Nagar (demo)",
         weight=2.5, length=20, width=15, height=10, priority="high", handling=["temperature_sensitive"], status="assigned"),
]


def seed_all(session: Session, workspace_id: str):
    ensure_workspace(session, workspace_id)
    now = datetime.now(timezone.utc)
    morning = now.replace(hour=8, minute=30, second=0, microsecond=0)

    # 1. Locations
    loc_map: dict[str, Location] = {}
    for lid, name, lat, lng, typ, zone, addr in LOCATIONS_DATA:
        existing = session.scalar(
            select(Location).where(Location.workspace_id == workspace_id, Location.name == name)
        )
        if not existing:
            loc = Location(
                id=lid, workspace_id=workspace_id, name=name, latitude=lat, longitude=lng,
                type=typ, zone=zone, address=addr, notes="Demo data"
            )
            session.add(loc)
            session.flush()
            loc_map[name] = loc
        else:
            loc_map[name] = existing

    # 2. Vehicles
    veh_map: dict[str, VehicleProfile] = {}
    for spec in VEHICLES_DATA:
        existing = session.scalar(
            select(VehicleProfile).where(VehicleProfile.workspace_id == workspace_id, VehicleProfile.name == spec["name"])
        )
        if not existing:
            data = {**spec}
            for k in ("energy_price", "fixed_cost_per_delivery", "operating_cost_per_km"):
                data[k] = Decimal(data[k])
            v = VehicleProfile(
                workspace_id=workspace_id, source=ASSUMED, verification="assumed", available=True, **data
            )
            session.add(v)
            session.flush()
            veh_map[spec["name"]] = v
        else:
            veh_map[spec["name"]] = existing

    # 3. Packages
    pkg_map: dict[str, Package] = {}
    for p in PACKAGES_DATA:
        existing = session.scalar(
            select(Package).where(Package.workspace_id == workspace_id, Package.reference == p["ref"])
        )
        loc = loc_map.get(p["loc_key"])
        lat = loc.latitude if loc else 13.0827
        lng = loc.longitude if loc else 80.2707
        vol = round(p["length"] * p["width"] * p["height"] / 1_000_000, 6)

        if not existing:
            pkg = Package(
                workspace_id=workspace_id,
                reference=p["ref"],
                recipient=p["recipient"],
                location_id=loc.id if loc else None,
                address=loc.address if loc else "Chennai",
                latitude=lat,
                longitude=lng,
                weight_kg=p["weight"],
                length_cm=p["length"],
                width_cm=p["width"],
                height_cm=p["height"],
                volume_m3=vol,
                priority=p["priority"],
                handling=p["handling"],
                window_start=morning,
                window_end=morning + timedelta(hours=9),
                service_minutes=5.0,
                kind="delivery",
                status=p["status"],
                notes="Demo package for Chennai operations",
            )
            session.add(pkg)
            session.flush()
            pkg_map[p["ref"]] = pkg
        else:
            pkg_map[p["ref"]] = existing

    # 4. Delivery Plans & Assignments
    depot_loc = loc_map.get("Depot (Chennai Central)")
    v_elec_van = veh_map.get("Electric mini truck (demo)")
    v_diesel_van = veh_map.get("Diesel delivery van (demo)")
    v_cng_3w = veh_map.get("CNG cargo three-wheeler (demo)")

    plan1 = session.scalar(
        select(DeliveryPlan).where(DeliveryPlan.workspace_id == workspace_id, DeliveryPlan.name == "Chennai Central Morning Dispatch (South & Central Zone)")
    )
    if not plan1 and depot_loc and v_elec_van and v_diesel_van:
        plan1 = DeliveryPlan(
            workspace_id=workspace_id,
            name="Chennai Central Morning Dispatch (South & Central Zone)",
            status="dispatched",
            depot_location_id=depot_loc.id,
            start_time=morning,
            total_distance_km=36.8,
            total_duration_min=105.0,
            total_cost=Decimal("385.00"),
            total_emissions_g=1420.0,
            notes="Active route serving central business districts and southern residential hubs.",
            config={"algorithm": "classical_guided", "objective": "balance", "max_vehicles": 2},
        )
        session.add(plan1)
        session.flush()

        assignments_data = [
            (v_elec_van.id, pkg_map["RZ-1004"].id, 0, morning + timedelta(minutes=25), 8.2, Decimal("45.00")),
            (v_elec_van.id, pkg_map["RZ-1005"].id, 1, morning + timedelta(minutes=45), 6.5, Decimal("35.00")),
            (v_elec_van.id, pkg_map["RZ-1006"].id, 2, morning + timedelta(minutes=70), 5.4, Decimal("32.00")),
            (v_diesel_van.id, pkg_map["RZ-1001"].id, 0, morning + timedelta(minutes=30), 7.1, Decimal("68.00")),
            (v_diesel_van.id, pkg_map["RZ-1003"].id, 1, morning + timedelta(minutes=65), 9.6, Decimal("75.00")),
        ]
        for vid, pid, seq, eta, dist, cost in assignments_data:
            session.add(PlanAssignment(
                workspace_id=workspace_id,
                plan_id=plan1.id,
                vehicle_id=vid,
                package_id=pid,
                sequence=seq,
                eta=eta,
                distance_km=dist,
                cost=cost,
            ))
        session.flush()

    plan2 = session.scalar(
        select(DeliveryPlan).where(DeliveryPlan.workspace_id == workspace_id, DeliveryPlan.name == "Chennai North-West Green Express")
    )
    if not plan2 and depot_loc and v_cng_3w:
        plan2 = DeliveryPlan(
            workspace_id=workspace_id,
            name="Chennai North-West Green Express",
            status="completed",
            depot_location_id=depot_loc.id,
            start_time=morning - timedelta(days=1),
            total_distance_km=24.5,
            total_duration_min=70.0,
            total_cost=Decimal("210.00"),
            total_emissions_g=0.0,
            notes="Completed zero-emission delivery cluster in Anna Nagar and West corridors.",
            config={"algorithm": "quantum_qaoa_hybrid", "objective": "emissions", "max_vehicles": 1},
        )
        session.add(plan2)
        session.flush()

        for seq, ref in enumerate(["RZ-1007", "RZ-1008", "RZ-1014"]):
            session.add(PlanAssignment(
                workspace_id=workspace_id,
                plan_id=plan2.id,
                vehicle_id=v_cng_3w.id,
                package_id=pkg_map[ref].id,
                sequence=seq,
                eta=morning - timedelta(days=1, minutes=60 - seq * 20),
                distance_km=8.0,
                cost=Decimal("35.00"),
            ))
        session.flush()

    # 5. Delivery Events (Live Dispatch Tracking)
    if plan1:
        existing_events = session.scalars(select(DeliveryEvent).where(DeliveryEvent.plan_id == plan1.id)).all()
        if not existing_events:
            events_data = [
                ("departed_depot", "Vehicle departed from Depot (Chennai Central)", morning, 13.0827, 80.2757, v_elec_van.id, None),
                ("arrived_at_stop", "Arrived at T. Nagar Silk Sarees", morning + timedelta(minutes=22), 13.0418, 80.2341, v_elec_van.id, pkg_map["RZ-1004"].id),
                ("delivered", "Delivered RZ-1004 (Signed by Store Manager)", morning + timedelta(minutes=28), 13.0418, 80.2341, v_elec_van.id, pkg_map["RZ-1004"].id),
                ("arrived_at_stop", "Arrived at Adyar Academic Books", morning + timedelta(minutes=46), 13.0012, 80.2565, v_elec_van.id, pkg_map["RZ-1005"].id),
                ("delivered", "Delivered RZ-1005 (Received at Front Desk)", morning + timedelta(minutes=50), 13.0012, 80.2565, v_elec_van.id, pkg_map["RZ-1005"].id),
                ("in_transit", "En route to Velachery Organic Market (Speed 28 km/h)", morning + timedelta(minutes=62), 12.9900, 80.2350, v_elec_van.id, pkg_map["RZ-1006"].id),
            ]
            for typ, msg, dt, lat, lng, vid, pid in events_data:
                session.add(DeliveryEvent(
                    workspace_id=workspace_id,
                    plan_id=plan1.id,
                    package_id=pid,
                    vehicle_id=vid,
                    type=typ,
                    message=msg,
                    occurred_at=dt,
                    latitude=lat,
                    longitude=lng,
                    payload={"battery_pct": 82, "traffic_delay_min": 0},
                ))
            session.flush()

    # 6. Scenarios
    scenarios_data = [
        ("Chennai High-Density Urban Morning (Central & South)", "recommendation",
         "Pre-dispatch multi-criteria powertrain recommendation matching 8 package stops with vehicle cost, volume, and payload limits.",
         {"_routezen": {"assumptions": ["Petrol ₹100/L", "Electricity ₹8/kWh"], "depot_label": "Chennai Central Depot"}},
         {"vehicles_recommended": 2, "estimated_cost_inr": 385.0, "total_distance_km": 36.8, "co2_kg": 1.42}),

        ("Classical OR-Tools VRPTW Baseline (8 Stops)", "classical",
         "Baseline capacitated vehicle routing with customer delivery time windows computed via Google OR-Tools guided local search.",
         {"_routezen": {"depot_label": "Chennai Central Depot"}, "time_limit_s": 5},
         {"objective_value": 36.8, "total_distance_km": 36.8, "total_duration_min": 105.0, "routes_count": 2}),

        ("Quantum-Assisted QAOA / Annealing Hybrid Route", "quantum",
         "Two-phase hybrid decomposition: global OR-Tools clustering + exact QUBO Hamiltonian formulation solved on Qiskit Aer / Simulated Annealing.",
         {"_routezen": {"depot_label": "Chennai Central Depot", "assumptions": ["N <= 4 sub-route decomposition"]}, "shots": 1024},
         {"quantum_energy": -14.8, "total_distance_km": 35.4, "total_duration_min": 101.0, "distance_improvement_pct": 3.8}),
    ]
    for s_name, s_kind, s_desc, s_cfg, s_res in scenarios_data:
        existing = session.scalar(
            select(Scenario).where(Scenario.workspace_id == workspace_id, Scenario.name == s_name)
        )
        if not existing:
            session.add(Scenario(
                workspace_id=workspace_id,
                name=s_name,
                kind=s_kind,
                description=s_desc,
                config=s_cfg,
                result=s_res,
                last_run_at=now - timedelta(hours=2),
            ))
            session.flush()

    # 7. Smart Travel Trips (Chennai to Leh Grand Adventure)
    trip_id = "demo-trip-001"
    existing_trip = session.get(TravelTrip, trip_id)
    if not existing_trip:
        trip = TravelTrip(
            id=trip_id,
            workspace_id=workspace_id,
            name="Chennai to Leh — Grand Adventure",
            status="planned",
            origin_name="Chennai, Tamil Nadu",
            origin_lat=13.0827,
            origin_lng=80.2707,
            destination_name="Leh, Ladakh",
            destination_lat=34.1526,
            destination_lng=77.5771,
            departure_date="2025-05-13",
            return_date=None,
            is_one_way=True,
            adults=2,
            children=0,
            older_travellers=0,
            travel_mode="car",
            notes="Looking for scenic routes, great local food, and comfortable rest stops.",
        )
        session.add(trip)
        session.flush()

        # Preferences
        session.add(TravelPreferences(
            trip_id=trip.id,
            pace="balanced",
            budget_category="mid_range",
            total_budget_inr=80000.0,
            accommodation_types=["mid_hotel", "homestay"],
            max_price_per_night=2500.0,
            food_preference="vegetarian",
            interests=["nature", "historical_places", "local_food", "photography"],
            max_drive_hours_per_day=8.0,
            max_drive_km_per_day=350.0,
            avoid_night_driving=True,
            meal_budget_per_person=400.0,
            contingency_pct=10.0,
        ))

        # Checkpoints
        checkpoints_data = [
            ("cp-01", 0, "Chennai, Tamil Nadu", "Chennai, TN", 13.0827, 80.2707, "origin", True, False, "2025-05-13T06:00:00", 0, None, None),
            ("cp-02", 1, "Vijayawada, Andhra Pradesh", "Vijayawada, AP", 16.5062, 80.6480, "mandatory", True, True, "2025-05-14T07:00:00", 120, 422.0, 360.0),
            ("cp-03", 2, "Hyderabad, Telangana", "Hyderabad, TS", 17.3850, 78.4867, "mandatory", True, True, "2025-05-15T07:00:00", 240, 280.0, 240.0),
            ("cp-04", 3, "Nagpur, Maharashtra", "Nagpur, MH", 21.1458, 79.0882, "optional", False, True, "2025-05-16T07:00:00", 60, 502.0, 420.0),
            ("cp-05", 4, "Jhansi, Uttar Pradesh", "Jhansi, UP", 25.4484, 78.5685, "optional", False, True, "2025-05-17T07:00:00", 90, 425.0, 380.0),
            ("cp-06", 5, "Delhi, NCR", "New Delhi", 28.6139, 77.2090, "mandatory", True, True, "2025-05-18T07:00:00", 180, 415.0, 360.0),
            ("cp-07", 6, "Manali, Himachal Pradesh", "Manali, HP", 32.2396, 77.1887, "mandatory", True, True, "2025-05-19T06:00:00", 120, 562.0, 480.0),
            ("cp-08", 7, "Leh, Ladakh", "Leh, Ladakh", 34.1526, 77.5771, "destination", True, False, None, 0, 479.0, 420.0),
        ]
        for cid, seq, cname, addr, clat, clng, ctype, mand, stay, dep, dur, dist, ptime in checkpoints_data:
            session.add(TravelCheckpoint(
                id=cid, trip_id=trip.id, sequence=seq, name=cname, address=addr,
                lat=clat, lng=clng, type=ctype, is_mandatory=mand, stay_overnight=stay,
                planned_departure=dep, activity_duration_min=dur, distance_from_prev_km=dist, duration_from_prev_min=ptime,
            ))

        # Route Options
        geom_rec = [[13.0827, 80.2707], [16.5062, 80.6480], [17.3850, 78.4867], [21.1458, 79.0882], [28.6139, 77.2090], [32.2396, 77.1887], [34.1526, 77.5771]]
        geom_fast = [[13.0827, 80.2707], [17.3850, 78.4867], [28.6139, 77.2090], [34.1526, 77.5771]]
        geom_scenic = [[13.0827, 80.2707], [16.5062, 80.6480], [17.3850, 78.4867], [21.1458, 79.0882], [25.4484, 78.5685], [28.6139, 77.2090], [32.2396, 77.1887], [34.1526, 77.5771]]

        session.add(TravelRouteOption(
            id="route-01", trip_id=trip.id, label="Recommended Route",
            description="Via Vijayawada → Hyderabad → Delhi → Manali",
            total_distance_km=3100.0, total_duration_min=2640.0, estimated_days=12,
            estimated_fuel_cost_inr=16800.0, estimated_total_cost_inr=48000.0,
            geometry=geom_rec, checkpoints=["cp-01", "cp-02", "cp-03", "cp-04", "cp-06", "cp-07", "cp-08"],
            is_selected=True, data_source="osrm+demo", fallback_estimate=False,
        ))
        session.add(TravelRouteOption(
            id="route-02", trip_id=trip.id, label="Fastest Route",
            description="Direct via NH-44 — fewer stops, 10–11 days",
            total_distance_km=2750.0, total_duration_min=2280.0, estimated_days=10,
            estimated_fuel_cost_inr=14900.0, estimated_total_cost_inr=42000.0,
            geometry=geom_fast, checkpoints=["cp-01", "cp-03", "cp-06", "cp-08"],
            is_selected=False, data_source="osrm+demo", fallback_estimate=False,
        ))
        session.add(TravelRouteOption(
            id="route-03", trip_id=trip.id, label="Scenic Route",
            description="Southern + Northern highway with extra hill stops",
            total_distance_km=3300.0, total_duration_min=3000.0, estimated_days=15,
            estimated_fuel_cost_inr=17900.0, estimated_total_cost_inr=58000.0,
            geometry=geom_scenic, checkpoints=["cp-01", "cp-02", "cp-03", "cp-04", "cp-05", "cp-06", "cp-07", "cp-08"],
            is_selected=False, data_source="osrm+demo", fallback_estimate=False, note="Includes Nagpur & Jhansi stops",
        ))

        # Places (Stays, Restaurants, Attractions)
        places_data = [
            ("stay-01", "cp-03", "stay", "Hotel Abode", "Banjara Hills, Hyderabad", 17.4126, 78.4483, "Comfortable mid-range hotel near Banjara Hills", 4.2, 230, 1600.0, 1800.0, "₹1,800/night (est.)", ["Free WiFi", "Breakfast", "Parking"], True),
            ("stay-02", "cp-03", "stay", "The Central Court", "HITEC City, Hyderabad", 17.4435, 78.3772, "Business hotel near HITEC City", 4.1, 185, 1900.0, 2100.0, "₹2,000/night (est.)", ["WiFi", "AC Rooms"], False),
            ("rest-01", "cp-03", "restaurant", "Bawchi Restaurant", "Basheer Bagh, Hyderabad", 17.4062, 78.4691, "Famous for Hyderabadi Biryani", 4.4, 2500, 300.0, 500.0, "₹300–500 per person", ["Vegetarian options", "AC"], True),
            ("rest-02", "cp-03", "restaurant", "Paradise Biryani", "Secunderabad, Hyderabad", 17.4428, 78.5029, "Iconic biryani — Mughlai style", 4.2, 5000, 300.0, 500.0, "₹300–500 per person", ["Vegetarian options"], False),
            ("attr-01", "cp-03", "attraction", "Charminar", "Old City, Hyderabad", 17.3616, 78.4747, "Iconic 16th-century mosque and monument — must visit", 4.4, 14200, 25.0, 25.0, "₹25 entry", ["Historic site", "Photography"], True),
            ("attr-02", "cp-03", "attraction", "Golconda Fort", "Golconda, Hyderabad", 17.3833, 78.4011, "Fort & history with acoustic architecture", 4.3, 11800, 15.0, 15.0, "₹15 entry", ["Historic site", "Guided tours"], True),
        ]
        for pid, cid, cat, pname, addr, plat, plng, pdesc, prat, preview, pmin, pmax, plbl, pamens, psel in places_data:
            session.add(TravelPlace(
                id=pid, trip_id=trip.id, checkpoint_id=cid, category=cat, name=pname, address=addr,
                lat=plat, lng=plng, description=pdesc, rating=prat, review_count=preview,
                price_min=pmin, price_max=pmax, price_label=plbl, amenities=pamens, is_selected=psel,
            ))

        # Itinerary Days
        days_data = [
            (1, "2025-05-13", "cp-01", "cp-02", 422.0, 360.0, 3500.0, "Start early from Chennai via NH-16",
             [{"id": "i-1", "sequence": 0, "type": "drive", "label": "Chennai → Vijayawada", "duration_min": 360, "cost_inr": 2800},
              {"id": "i-2", "sequence": 1, "type": "stay", "label": "Check-in Vijayawada hotel", "duration_min": 30, "cost_inr": 700}]),
            (2, "2025-05-14", "cp-02", "cp-03", 280.0, 240.0, 4000.0, "Vijayawada to Hyderabad & cultural exploration",
             [{"id": "i-3", "sequence": 0, "type": "drive", "label": "Vijayawada → Hyderabad", "duration_min": 240, "cost_inr": 1900},
              {"id": "i-4", "sequence": 1, "type": "attraction", "label": "Golconda Fort visit", "duration_min": 120, "cost_inr": 30},
              {"id": "i-5", "sequence": 2, "type": "meal", "label": "Lunch at Bawchi", "duration_min": 60, "cost_inr": 800},
              {"id": "i-6", "sequence": 3, "type": "stay", "label": "Hotel Abode check-in", "duration_min": 30, "cost_inr": 1800}]),
            (3, "2025-05-15", "cp-03", "cp-04", 502.0, 420.0, 4500.0, "Transit drive north through Maharashtra",
             [{"id": "i-7", "sequence": 0, "type": "drive", "label": "Hyderabad → Nagpur", "duration_min": 420, "cost_inr": 3400},
              {"id": "i-8", "sequence": 1, "type": "stay", "label": "Nagpur overnight", "duration_min": 30, "cost_inr": 1100}]),
        ]
        for dnum, ddate, scp, ecp, ddist, ddur, dcost, dnotes, ditems in days_data:
            session.add(TravelItineraryDay(
                id=f"day-0{dnum}", trip_id=trip.id, day_number=dnum, date=ddate,
                start_checkpoint_id=scp, end_checkpoint_id=ecp, drive_distance_km=ddist,
                drive_duration_min=ddur, estimated_cost_inr=dcost, notes=dnotes, items=ditems,
            ))

    session.commit()
    print("Database seeding completed successfully.")


if __name__ == "__main__":
    with get_sessionmaker()() as s:
        seed_all(s, get_settings().workspace_id)
