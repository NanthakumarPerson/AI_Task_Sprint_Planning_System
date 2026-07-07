// src/api/requirements.js
import api from './axios';

export const createRequirement = (data) => api.post('/requirements', data);

export const getRequirements = (params) => api.get('/requirements', { params });

export const getRequirement = (id) => api.get(`/requirements/${id}`);

export const updateRequirementStatus = (id, status) => api.patch(`/requirements/${id}/status`, { status });

export const updateRequirement = (id, data) => api.put(`/requirements/${id}`, data);

export const deleteRequirement = (id) => api.delete(`/requirements/${id}`);
