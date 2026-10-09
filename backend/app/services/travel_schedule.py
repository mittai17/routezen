"""Travel Schedule & Itinerary Builder Service."""
from __future__ import annotations

from typing import Any


class TravelScheduleService:
    def build_itinerary(
        self,
        checkpoints: list[dict[str, Any]],
        max_drive_hours: float = 8.0,
        departure_date: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Segments the sequence of checkpoints into realistic day-by-day itineraries,
        balancing driving fatigue, meal halts, and overnight hubs.
        """
        if not checkpoints:
            return []

        days: list[dict[str, Any]] = []
        current_day_items: list[dict[str, Any]] = []
        current_day_dist = 0.0
        current_day_duration_min = 0.0
        day_number = 1

        for i, cp in enumerate(checkpoints):
            if i == 0:
                continue

            prev_cp = checkpoints[i - 1]
            leg_dist = cp.get("distance_from_prev_km") or 350.0
            leg_duration = cp.get("duration_from_prev_min") or round(leg_dist / 65.0 * 60.0)

            # Drive segment
            drive_item = {
                "id": f"item-{day_number}-drive",
                "sequence": len(current_day_items),
                "type": "drive",
                "label": f"{prev_cp.get('name', 'Origin').split(',')[0]} → {cp.get('name', 'Waypoint').split(',')[0]}",
                "place_id": None,
                "checkpoint_id": cp.get("id"),
                "start_time": "07:00",
                "end_time": "14:00",
                "duration_min": int(leg_duration),
                "cost_inr": round(leg_dist / 14.0 * 105.0),
                "notes": "Highway cruise leg",
            }
            current_day_items.append(drive_item)
            current_day_dist += leg_dist
            current_day_duration_min += leg_duration

            # If checkpoint has activity dwell, add attraction item
            activity_dwell = cp.get("activity_duration_min", 0)
            if activity_dwell > 0:
                current_day_items.append({
                    "id": f"item-{day_number}-sightseeing",
                    "sequence": len(current_day_items),
                    "type": "attraction",
                    "label": f"Sightseeing at {cp.get('name', '').split(',')[0]}",
                    "place_id": None,
                    "checkpoint_id": cp.get("id"),
                    "start_time": "15:00",
                    "end_time": "17:00",
                    "duration_min": int(activity_dwell),
                    "cost_inr": 100.0,
                    "notes": cp.get("notes") or "Local exploration",
                })

            # Check if overnight stop or exceeds max drive time
            is_overnight = cp.get("stay_overnight", False) or i == len(checkpoints) - 1 or (current_day_duration_min / 60.0) >= max_drive_hours

            if is_overnight or i == len(checkpoints) - 1:
                # Add stay item
                current_day_items.append({
                    "id": f"item-{day_number}-stay",
                    "sequence": len(current_day_items),
                    "type": "stay",
                    "label": f"Overnight at {cp.get('name', '').split(',')[0]}",
                    "place_id": None,
                    "checkpoint_id": cp.get("id"),
                    "start_time": "18:00",
                    "end_time": "18:30",
                    "duration_min": 30,
                    "cost_inr": 1800.0,
                    "notes": "Hotel check-in & rest",
                })

                days.append({
                    "day_number": day_number,
                    "date": departure_date,
                    "start_checkpoint_id": prev_cp.get("id"),
                    "end_checkpoint_id": cp.get("id"),
                    "drive_distance_km": round(current_day_dist, 1),
                    "drive_duration_min": round(current_day_duration_min),
                    "estimated_cost_inr": round(sum(it["cost_inr"] for it in current_day_items) + 800.0),  # + meals
                    "notes": f"Day {day_number} journey towards {cp.get('name', '').split(',')[0]}",
                    "items": current_day_items,
                })

                day_number += 1
                current_day_items = []
                current_day_dist = 0.0
                current_day_duration_min = 0.0

        return days
