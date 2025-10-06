import axios from 'axios';
import type { LoginResponse, TokenValidationResponse, RefreshResponse } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5219';
const AUTH_BASE_URL = import.meta.env.VITE_API_BASE_URL_AUTH ?? API_BASE_URL;
const AUTH_LOGIN_PATH = import.meta.env.VITE_API_AUTH_LOGIN_PATH ?? '/login';
const AUTH_IDENT_PATH = import.meta.env.VITE_API_AUTH_IDENT_PATH ?? '/ident';
const AUTH_REFRESH_PATH = import.meta.env.VITE_API_AUTH_REFRESH_PATH ?? '/refresh';

const api = axios.create({
  baseURL: API_BASE_URL,
});

const authClient = axios.create({
  baseURL: AUTH_BASE_URL,
});

const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url);

const resolveTargetPath = (path: string | null | undefined, fallback: string) => {
  const trimmed = (path ?? '').trim();
  return trimmed || fallback;
};

const toRelativePath = (path: string) => (path.startsWith('/') ? path : '/' + path);

const postMultipart = <T>(path: string | null | undefined, fallback: string, formData: FormData) => {
  const target = resolveTargetPath(path, fallback);
  const config = {
    headers: {
      Accept: 'text/plain',
    },
  };

  if (isAbsoluteUrl(target)) {
    return axios.post<T>(target, formData, config);
  }

  return authClient.post<T>(toRelativePath(target), formData, config);
};

export const authenticate = (username: string, password: string) => {
  const formData = new FormData();
  formData.append('ident', username);
  formData.append('senha', password);

  return postMultipart<LoginResponse>(AUTH_LOGIN_PATH, '/login', formData);
};

export const validateToken = (token: string) => {
  const formData = new FormData();
  formData.append('jwt', token);

  return postMultipart<TokenValidationResponse>(AUTH_IDENT_PATH, '/ident', formData);
};

export const refreshSession = (refreshToken: string) => {
  const trimmed = refreshToken.trim();
  if (!trimmed) {
    return Promise.reject(new Error('Missing refresh token'));
  }

  const target = resolveTargetPath(AUTH_REFRESH_PATH, '/refresh');
  const config = {
    params: {
      r: trimmed,
    },
  };

  if (isAbsoluteUrl(target)) {
    return axios.get<RefreshResponse>(target, config);
  }

  return authClient.get<RefreshResponse>(toRelativePath(target), config);
};

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = 'Bearer ' + token;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export default api;
