// src/api/dashboard.js
import api from './axios';

export const getDashboardSprint = (sprintId) =>
  api.get('/dashboard/sprint', { params: sprintId ? { sprint_id: sprintId } : {} });