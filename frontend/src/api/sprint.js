// src/api/sprint.js
import api from './axios';

export const createSprint = (data) => api.post('/sprints', data);

export const getSprintReport = (sprintId) =>
  api.get(`/sprints/${sprintId}/report`);

export const getSprints = (params) =>
  api.get('/sprints', { params });

export const startSprint = (sprintId) =>
  api.patch(`/sprints/${sprintId}/start`);

export const updateSprint = (sprintId, data) =>
  api.put(`/sprints/${sprintId}`, data);

export const completeSprint = (sprintId, data) =>
  api.patch(`/sprints/${sprintId}/complete`, data);

export const cancelSprint = (sprintId, data) =>
  api.patch(`/sprints/${sprintId}/cancel`, data);

export const getSprintById = (sprintId) =>
  api.get(`/sprints/${sprintId}`);

export const getMySprints = () =>
  api.get('/sprints/my-sprints');