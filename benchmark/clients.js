// HTTP Client implementations for benchmarking
import axios from 'axios';
import fetch from 'node-fetch';
import { fetch as undiciFetch } from 'undici';
import setu from '../dist/node/index.js';

const BASE_URL = 'http://localhost:3001';

// Native fetch (Node 18+)
const nativeFetch = globalThis.fetch || fetch;

export const clients = {
  'Setu.js': {
    get: async (url, options = {}) => {
      try {
        return await setu.get(BASE_URL + url, options);
      } catch (error) {
        // Setu.js throws errors for non-2xx status codes
        // Convert to response format for consistency
        if (error.response) {
          return error.response;
        }
        // For timeout/network errors, rethrow
        throw error;
      }
    },
    post: async (url, body, options = {}) => {
      try {
        return await setu.post(BASE_URL + url, { ...options, body });
      } catch (error) {
        // Setu.js throws errors for non-2xx status codes
        // Convert to response format for consistency
        if (error.response) {
          return error.response;
        }
        // For timeout/network errors, rethrow
        throw error;
      }
    },
    supportsRetry: true,
    supportsTimeout: true,
  },

  'Axios': {
    get: async (url, options = {}) => {
      const response = await axios.get(BASE_URL + url, {
        timeout: options.timeout,
        headers: options.headers,
        validateStatus: () => true, // Don't throw on error status
      });
      return {
        status: response.status,
        data: response.data,
        headers: response.headers,
      };
    },
    post: async (url, body, options = {}) => {
      const response = await axios.post(BASE_URL + url, body, {
        timeout: options.timeout,
        headers: options.headers,
        validateStatus: () => true,
      });
      return {
        status: response.status,
        data: response.data,
        headers: response.headers,
      };
    },
    supportsRetry: false, // Need axios-retry package
    supportsTimeout: true,
  },

  'node-fetch': {
    get: async (url, options = {}) => {
      const controller = new AbortController();
      if (options.timeout) {
        setTimeout(() => controller.abort(), options.timeout);
      }
      const response = await fetch(BASE_URL + url, {
        signal: controller.signal,
        headers: options.headers,
      });
      const data = await response.json();
      return {
        status: response.status,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };
    },
    post: async (url, body, options = {}) => {
      const controller = new AbortController();
      if (options.timeout) {
        setTimeout(() => controller.abort(), options.timeout);
      }
      const response = await fetch(BASE_URL + url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json', ...options.headers },
        signal: controller.signal,
      });
      const data = await response.json();
      return {
        status: response.status,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };
    },
    supportsRetry: false,
    supportsTimeout: true,
  },

  'undici': {
    get: async (url, options = {}) => {
      const response = await undiciFetch(BASE_URL + url, {
        signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
        headers: options.headers,
      });
      const data = await response.json();
      return {
        status: response.status,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };
    },
    post: async (url, body, options = {}) => {
      const response = await undiciFetch(BASE_URL + url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json', ...options.headers },
        signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
      });
      const data = await response.json();
      return {
        status: response.status,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };
    },
    supportsRetry: false,
    supportsTimeout: true,
  },

  'Native Fetch': {
    get: async (url, options = {}) => {
      const controller = new AbortController();
      if (options.timeout) {
        setTimeout(() => controller.abort(), options.timeout);
      }
      const response = await nativeFetch(BASE_URL + url, {
        signal: controller.signal,
        headers: options.headers,
      });
      const data = await response.json();
      return {
        status: response.status,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };
    },
    post: async (url, body, options = {}) => {
      const controller = new AbortController();
      if (options.timeout) {
        setTimeout(() => controller.abort(), options.timeout);
      }
      const response = await nativeFetch(BASE_URL + url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json', ...options.headers },
        signal: controller.signal,
      });
      const data = await response.json();
      return {
        status: response.status,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };
    },
    supportsRetry: false,
    supportsTimeout: true,
  },
};

// Initialize clients (async function to handle optional got)
export async function initializeClients() {
  // Try to add got if available (optional dependency)
  try {
    const gotModule = await import('got');
    const got = gotModule.default;
    
    if (got) {
      clients['got'] = {
        get: async (url, options = {}) => {
          try {
            const response = await got.get(BASE_URL + url, {
              timeout: { request: options.timeout },
              headers: options.headers,
              throwHttpErrors: false,
            });
            return {
              status: response.statusCode,
              data: JSON.parse(response.body),
              headers: response.headers,
            };
          } catch (error) {
            if (error.response) {
              return {
                status: error.response.statusCode,
                data: JSON.parse(error.response.body || '{}'),
                headers: error.response.headers,
              };
            }
            throw error;
          }
        },
        post: async (url, body, options = {}) => {
          try {
            const response = await got.post(BASE_URL + url, {
              json: body,
              timeout: { request: options.timeout },
              headers: options.headers,
              throwHttpErrors: false,
            });
            return {
              status: response.statusCode,
              data: JSON.parse(response.body),
              headers: response.headers,
            };
          } catch (error) {
            if (error.response) {
              return {
                status: error.response.statusCode,
                data: JSON.parse(error.response.body || '{}'),
                headers: error.response.headers,
              };
            }
            throw error;
          }
        },
        supportsRetry: true,
        supportsTimeout: true,
      };
    }
  } catch {
    // got not available, skip it
  }
  
  return clients;
}

