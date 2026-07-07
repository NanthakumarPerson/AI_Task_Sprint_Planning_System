// src/api/tasks.js
import api from './axios';

export const getTasks = (params) => api.get('/tasks', { params });

const statusMap = {
  todo: "TODO",
  inProgress: "IN_PROGRESS",
  inReview: "IN_REVIEW",
  done: "DONE",
};

export const updateTaskStatus = (taskId, data) => {
  if (data.status) {
    // If the frontend uses camelCase or lower case, map it to the standardized uppercase status
    data.status = statusMap[data.status] || data.status.toUpperCase();
  }
  return api.patch(`/tasks/${taskId}/status`, data);
};

export const createTasks = (data) => api.post('/tasks', data);

export const createSingleTask = (data) => api.post('/tasks/single', data);

export const getTasksBySprint = (sprintId) =>
  api.get(`/tasks/by-sprint/${sprintId}`);

export const getMyTasks = () => api.get('/tasks/my-tasks');

export const updateTask = (taskId, data) =>
  api.put(`/tasks/${taskId}`, data);

export const reassignTask = (taskId, data) =>
  api.patch(`/tasks/${taskId}/assignee`, data);

export const removeTaskFromSprint = (taskId) =>
  api.patch(`/tasks/${taskId}/remove-from-sprint`);

export const deleteTask = (taskId) =>
  api.delete(`/tasks/${taskId}`);

export const getBacklogTasks = () =>
  api.get('/tasks/backlog');

export const assignSprint = (taskId, sprintId) =>
  api.patch(`/tasks/${taskId}/assign-sprint`, { sprint_id: sprintId });

export const getMyTasksBySprint = (sprintId) =>
  api.get(`/tasks/by-sprint/${sprintId}/my-tasks`);

export const addTaskComment = (taskId, data) =>
  api.post(`/tasks/${taskId}/comments`, data);