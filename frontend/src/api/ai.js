// src/api/ai.js
// AI task-breakdown API calls.
// These go through FastAPI — the AI key is NEVER in frontend code.
import api from './axios';

export const generateTaskBreakdown = (data) =>
  api.post('/ai/task-breakdown', data);

export const confirmAITasks = (data) =>
  api.post('/ai/confirm-tasks', data);
