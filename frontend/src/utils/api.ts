import { getAuthHeaders, getIdToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL || '';

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
  stream?: boolean;
}

// Helper function to handle API requests with token refresh
const handleApiRequest = async (requestFn: () => Promise<Response>): Promise<Response> => {
  try {
    return await requestFn();
  } catch (error) {
    // Check if it's a token-related error (401 Unauthorized or token revoked)
    if (error instanceof Error && 
        (error.message.includes('401') || 
         error.message.includes('auth/id-token-revoked'))) {
      console.log('Token may be revoked, attempting to refresh...');
      
      // Try to get a fresh token by forcing a refresh
      const freshToken = await getIdToken(true);
      
      if (freshToken) {
        // Retry the request with the fresh token
        return await requestFn();
      }
    }
    
    // If it's not a token error or refresh failed, rethrow
    throw error;
  }
};

export const api = {
  get: async (endpoint: string, options: ApiOptions = {}) => {
    const makeRequest = async () => {
      const { skipAuth, stream, ...fetchOptions } = options;
      const headers = skipAuth ? 
        { 'Content-Type': 'application/json' } : 
        await getAuthHeaders();

      const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

      const response = await fetch(fullUrl, {
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
    };

    return handleApiRequest(makeRequest);
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
