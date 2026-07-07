import api from "./axios";

export async function loginApi(email, password) {
    const res = await api.post("/auth/login", { email, password });
    return res.data;
}

export const getTeamUsers = () => api.get('/auth/users');