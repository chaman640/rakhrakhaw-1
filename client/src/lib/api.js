import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// Har request pe token laga do
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rr_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Error ko ek jaisa banao — har page pe err.message seedha dikha sakein
api.interceptors.response.use(
  (res) => res.data,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      error.message ||
      'Kuch gadbad ho gayi, dobara koshish karein';

    if (status === 401) {
      localStorage.removeItem('rr_token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject({
      status,
      message,
      details: error.response?.data?.details || null,
    });
  }
);

export default api;
