// src/api/projects.js
import api from './axios';

export const createProject = (data) => api.post('/projects', data);

export const getProjects = () => api.get('/projects');

export const getProject = (id) => api.get(`/projects/${id}`);