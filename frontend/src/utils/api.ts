import { getAuthHeaders, getIdToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL || '';
const DEFAULT_TIMEOUT = 30000; // 30 seconds default timeout
const MAX_RETRIES = 2; // Maximum number of retries for failed requests

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
  stream?: boolean;
  timeout?: number;
  retries?: number;
}

// Helper function to create a fetch request with timeout
const fetchWithTimeout = async (url: string, options: RequestInit & { timeout?: number }): Promise<Response> => {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

// Helper function to handle API requests with token refresh and retries
const handleApiRequest = async (requestFn: () => Promise<Response>, retries = MAX_RETRIES): Promise<Response> => {
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
    
    // Handle network errors with retries
    if (error instanceof Error && 
        (error.message.includes('network') || 
         error.message.includes('timeout') ||
         error.message.includes('ERR_NETWORK'))) {
      if (retries > 0) {
        console.log(`Network error, retrying... (${retries} attempts left)`);
        // Exponential backoff: wait longer between each retry
        const backoffTime = Math.pow(2, MAX_RETRIES - retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return handleApiRequest(requestFn, retries - 1);
      }
    }
    
    // If it's not a token error or refresh failed, rethrow
    throw error;
  }
};

export const api = {
  get: async (endpoint: string, options: ApiOptions = {}) => {
    const makeRequest = async () => {
      const { skipAuth, stream, timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES, ...fetchOptions } = options;
      const headers = skipAuth ? 
        { 'Content-Type': 'application/json' } : 
        await getAuthHeaders();

      const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

      // Use fetchWithTimeout for non-streaming requests
      // For streaming requests, we'll use regular fetch as timeouts can interfere with streams
      const fetchFn = stream ? fetch : fetchWithTimeout;
      
      const response = await fetchFn(fullUrl, {
        ...fetchOptions,
        timeout: stream ? undefined : timeout,
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

    return handleApiRequest(makeRequest, options.retries);
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
