import axios from 'axios';

// In local development Vite proxies /api to the backend. In Vercel, set
// VITE_API_URL to the deployed backend URL (for example, https://api.example.com/api).
const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL,
  timeout: 15000
});

export function setAdminToken(token) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}
