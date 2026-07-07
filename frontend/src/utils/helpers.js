// src/utils/helpers.js
export const getToken  = ()      => localStorage.getItem('token');
export const saveToken = (t)     => localStorage.setItem('token', t);
export const clearToken = ()     => localStorage.removeItem('token');
export const saveUser  = (u)     => localStorage.setItem('user', JSON.stringify(u));
export const getUser   = ()      => JSON.parse(localStorage.getItem('user') || 'null');

export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export const truncateText = (text, len = 80) =>
  text?.length > len ? text.slice(0, len) + '…' : text;

// ── Priority badge classes (lowercase keys match DB enum) ─────────────
export const priorityClass = (priority) => {
  const map = {
    critical: 'badge-critical',
    high:     'badge-high',
    medium:   'badge-medium',
    low:      'badge-low',
  };
  return map[priority] || '';
};

// ── Task type badge classes (lowercase keys match DB enum) ────────────
export const taskTypeClass = (type) => {
  const map = {
    development:   'badge-development',
    testing:       'badge-testing',
    bug:           'badge-bug',
    documentation: 'badge-documentation',
  };
  return map[type] || '';
};

// ── Status label helper — maps DB enum to human-readable display ──────
export const statusLabel = (status) => {
  const map = {
    TODO:        'To Do',
    IN_PROGRESS: 'In Progress',
    IN_REVIEW:   'In Review',
    DONE:        'Done',
  };
  return map[status] || status;
};

// ── Status action button helper — maps status to next action button ───
export const statusAction = (status) => {
  const map = {
    TODO:        { label: 'Start Task',     nextStatus: 'IN_PROGRESS', disabled: false },
    IN_PROGRESS: { label: 'Move to Review', nextStatus: 'IN_REVIEW',   disabled: false },
    IN_REVIEW:   { label: 'Mark Done',      nextStatus: 'DONE',        disabled: false },
    DONE:        { label: 'Completed',      nextStatus: null,           disabled: true  },
  };
  return map[status] || { label: status, nextStatus: null, disabled: true };
};

// ── Days remaining helper ─────────────────────────────────────────────
export const daysRemaining = (endDateStr) => {
  if (!endDateStr) return null;
  const end = new Date(endDateStr);
  const now = new Date();
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return diff;
};

export const validateEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ── Shared error parsing helper ────────────────────────────────────────
export const getErrorMessage = (err) => {
  const detail = err?.response?.data?.detail;
  const message = err?.response?.data?.message;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e.msg).join(", ");
  if (typeof message === "string") return message;
  return "Something went wrong. Please try again.";
};