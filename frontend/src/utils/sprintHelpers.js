/**
 * src/utils/sprintHelpers.js
 * --------------------------
 * Shared sprint classification utility — mirrors backend app/utils/sprint_state.py.
 * Use classifySprint() everywhere a sprint's state needs to be determined.
 *
 * States:
 *   "upcoming"       — planning, start_date > today
 *   "ready_to_start" — planning, start_date <= today <= end_date
 *   "active"         — active,   start_date <= today <= end_date
 *   "ended"          — active,   end_date < today
 *   "completed"      — completed (read-only)
 *   "cancelled"      — cancelled
 *   "planning"       — planning with no date match (generic fallback)
 */

export const SPRINT_STATE_LABELS = {
    upcoming:       'Upcoming',
    ready_to_start: 'Ready to Start',
    active:         'Active',
    ended:          'Ended / Needs Completion',
    completed:      'Completed',
    cancelled:      'Cancelled',
    planning:       'Planning',
};

/**
 * @param {Object} sprint  — sprint object with start_date, end_date (string 'YYYY-MM-DD'), status
 * @returns {string}       — state key
 */
export function classifySprint(sprint) {
    if (!sprint) return 'planning';

    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
    const status = (sprint.status || '').toLowerCase();

    if (status === 'completed') return 'completed';
    if (status === 'cancelled') return 'cancelled';

    if (status === 'planning') {
        if (sprint.start_date && sprint.end_date) {
            if (sprint.start_date > today) return 'upcoming';
            if (sprint.start_date <= today && sprint.end_date >= today) return 'ready_to_start';
        }
        return 'planning';
    }

    if (status === 'active') {
        if (sprint.end_date && sprint.end_date < today) return 'ended';
        return 'active';
    }

    return status;
}

/**
 * Returns a CSS badge class name for a given sprint state.
 */
export function sprintStateBadgeClass(state) {
    const MAP = {
        upcoming:       'badge-TODO',
        ready_to_start: 'badge-IN_REVIEW',
        active:         'badge-DONE',
        ended:          'badge-IN_PROGRESS',
        completed:      'badge',
        cancelled:      'badge',
        planning:       'badge-TODO',
    };
    return MAP[state] || 'badge';
}

/**
 * True if the sprint is genuinely active today (not just status=active).
 */
export function isActiveSprint(sprint) {
    return classifySprint(sprint) === 'active';
}

/**
 * True if tasks in this sprint are fully read-only.
 */
export function isCompletedSprint(sprint) {
    return classifySprint(sprint) === 'completed';
}

/**
 * True if a "Start Sprint" button should be shown.
 */
export function isReadyToStart(sprint) {
    return classifySprint(sprint) === 'ready_to_start';
}
