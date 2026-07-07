"""
app/utils/sprint_state.py
--------------------------
Shared sprint classification utility used across the entire backend.
Call classify_sprint(sprint) to get a consistent state string and human-readable label.

State values:
  "upcoming"       - status=planning, start_date > today  (not yet started, not yet time)
  "ready_to_start" - status=planning, start_date <= today <= end_date  (PM must manually start)
  "active"         - status=active, start_date <= today <= end_date
  "ended"          - status=active, end_date < today  (needs completion action)
  "completed"      - status=completed (read-only for all)
  "cancelled"      - status=cancelled
  "planning"       - status=planning with no date context match (generic fallback)
"""

from datetime import date as date_type


STATE_LABELS = {
    "upcoming":       "Upcoming",
    "ready_to_start": "Ready to Start",
    "active":         "Active",
    "ended":          "Ended / Needs Completion",
    "completed":      "Completed",
    "cancelled":      "Cancelled",
    "planning":       "Planning",
}


def classify_sprint(sprint) -> str:
    """
    Return one of: "upcoming", "ready_to_start", "active", "ended",
    "completed", "cancelled", "planning"
    """
    today = date_type.today()
    status = (sprint.status or "").lower()

    if status == "completed":
        return "completed"

    if status == "cancelled":
        return "cancelled"

    if status == "planning":
        if sprint.start_date and sprint.end_date:
            if sprint.start_date > today:
                return "upcoming"
            if sprint.start_date <= today <= sprint.end_date:
                return "ready_to_start"
        return "planning"

    if status == "active":
        if sprint.end_date and sprint.end_date < today:
            return "ended"
        return "active"

    # Fallback
    return status


def get_state_label(state: str) -> str:
    """Return a human-readable label for a sprint state."""
    return STATE_LABELS.get(state, state.replace("_", " ").title())


def is_editable_sprint(sprint) -> bool:
    """True if tasks in this sprint can be edited (not completed)."""
    state = classify_sprint(sprint)
    return state != "completed"


def is_active_sprint(sprint) -> bool:
    """
    True only if the sprint is genuinely active today (status=active AND date range includes today).
    This is the correct definition — do NOT use status == 'active' alone.
    """
    return classify_sprint(sprint) == "active"
