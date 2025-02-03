import { getAuthHeaders } from './auth';

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
  stream?: boolean;
}

export const api = {
  get: async (endpoint: string, options: ApiOptions = {}) => {
    const { skipAuth, stream, ...fetchOptions } = options;
    const headers = skipAuth ? 
      { 'Content-Type': 'application/json' } : 
      await getAuthHeaders();

    const response = await fetch(endpoint, {
      ...fetchOptions,
      headers: {
        ...headers,
        ...(stream ? { 'Accept': 'text/event-stream' } : { 'Content-Type': 'application/json' }),
        ...fetchOptions.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response;
  },

  post: async (endpoint: string, data?: any, options: ApiOptions = {}) => {
    return api.get(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  },

  put: async (endpoint: string, data?: any, options: ApiOptions = {}) => {
    return api.get(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  },

  delete: async (endpoint: string, options: ApiOptions = {}) => {
    return api.get(endpoint, {
      ...options,
      method: 'DELETE'
    });
  }
};
