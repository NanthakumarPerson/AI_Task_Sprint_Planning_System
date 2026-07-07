// src/utils/constants.js

// ── Task Status ──────────────────────────────────────────────────────────
export const STATUS_OPTIONS = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'DONE', label: 'Done' },
];

// ── Task Priority ────────────────────────────────────────────────────────
export const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

// ── Task Type ────────────────────────────────────────────────────────────
export const TASK_TYPE_OPTIONS = [
  { value: 'development', label: 'Development' },
  { value: 'testing', label: 'Testing' },
  { value: 'bug', label: 'Bug' },
  { value: 'documentation', label: 'Documentation' },
];

// ── Sprint Status ────────────────────────────────────────────────────────
export const SPRINT_STATUS_OPTIONS = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const EFFORT_OPTIONS = [1, 2, 3, 5, 8, 13];

export const ROLE = {
  ADMIN: 1,
  PM: 2,
  DEVELOPER: 3,
  TESTER: 4,
};

export const ROLE_OPTIONS = [
  { value: 1, label: 'Admin' },
  { value: 2, label: 'PM' },
  { value: 3, label: 'Developer' },
  { value: 4, label: 'Tester' },
];