// src/api/admin.js
import api from './axios';

export const getUsers = () => api.get('/admin/users');

export const createUser = (data) => api.post('/admin/users', data);

export const updateUser = (userId, data) => api.put(`/admin/users/${userId}`, data);

export const resetUserPassword = (userId, password) =>
  api.patch(`/admin/users/${userId}/password`, { password });

export const deleteUser = (userId) => api.delete(`/admin/users/${userId}`);
