import axios from "axios";
import { getToken, clearToken } from "../utils/helpers";

const api = axios.create({
    baseURL: "/api",
    headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// If backend returns 401, clear local storage and redirect to login.
// Exception: don't redirect on the login endpoint itself — let the page show the error.
api.interceptors.response.use(
    (res) => res,
    (err) => {
        const isLoginRequest = err.config?.url?.includes('/auth/login');
        if (err.response?.status === 401 && !isLoginRequest) {
            clearToken();
            window.location.href = "/login";
        }
        return Promise.reject(err);
    }
);

export default api;