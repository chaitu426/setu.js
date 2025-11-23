import { HttpRequestConfig, HttpResponse } from './coreRequest.js';
import { defaults } from './defaults.js';

export function browserAdapter<T = any>(
  url: string,
  config: HttpRequestConfig & {
    onUploadProgress?: (progress: { loaded: number; total?: number; percent: number }) => void;
    onDownloadProgress?: (progress: { loaded: number; total?: number; percent: number }) => void;
    validateStatus?: (status: number) => boolean;
  } = {}
): Promise<HttpResponse<T>> {
  const makeRequest = (attempt: number): Promise<HttpResponse<T>> => {
    return new Promise((resolve, reject) => {
      const method = (config.method || 'GET').toUpperCase();
      const isGetLike = ['GET', 'HEAD'].includes(method);

      // Merge query params
      // Handle URL with hash fragments - split on '?' but preserve hash
      const urlParts = url.split('#');
      const urlWithoutHash = urlParts[0];
      const hash = urlParts.length > 1 ? '#' + urlParts.slice(1).join('#') : '';
      
      const [baseUrl, existingQuery] = urlWithoutHash.split('?');
      const combinedParams = new URLSearchParams(existingQuery || '');
      if (config.params) {
        Object.entries(config.params).forEach(([key, value]) => {
          // Handle null, undefined, and complex objects
          if (value === null || value === undefined) {
            combinedParams.set(key, '');
          } else if (typeof value === 'object') {
            combinedParams.set(key, JSON.stringify(value));
          } else {
            combinedParams.set(key, String(value));
          }
        });
      }
      
      // Build final URL - handle empty baseURL edge case
      let finalBaseUrl = baseUrl;
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        if (defaults.baseURL) {
          // Ensure proper joining (remove trailing/leading slashes appropriately)
          const base = defaults.baseURL.endsWith('/') ? defaults.baseURL.slice(0, -1) : defaults.baseURL;
          const path = baseUrl.startsWith('/') ? baseUrl : '/' + baseUrl;
          finalBaseUrl = base + path;
        } else if (!baseUrl.startsWith('/')) {
          // Relative URL without baseURL - keep as is
          finalBaseUrl = baseUrl;
        }
      }
      
      const queryString = combinedParams.toString();
      const finalUrl = finalBaseUrl + (queryString ? '?' + queryString : '') + hash;

      const xhr = new XMLHttpRequest();
      xhr.open(method, finalUrl, true);

      if (config.timeout) xhr.timeout = config.timeout;
      // Handle different response types
      if (config.responseType === 'blob') {
        xhr.responseType = 'blob';
      } else if (config.responseType === 'arraybuffer') {
        xhr.responseType = 'arraybuffer';
      } else if (config.responseType === 'text' || !config.responseType) {
        xhr.responseType = 'text';
      }
      // 'json' and 'document' are handled via responseType='text' and manual parsing

      // Track abort handler for cleanup
      let abortHandler: (() => void) | null = null;
      if (config.signal) {
        abortHandler = () => {
          xhr.abort();
          reject(buildError('Request aborted', config, 'ECONNABORTED', xhr));
        };
        config.signal.addEventListener('abort', abortHandler);
      }

      const isFormData = config.body instanceof FormData;
      // Fix: null is typeof 'object' in JavaScript, need explicit check
      const isJSON = config.body !== null && 
                     config.body !== undefined && 
                     typeof config.body === 'object' && 
                     !isFormData &&
                     !Array.isArray(config.body) &&
                     !(config.body instanceof Date) &&
                     !(config.body instanceof RegExp);

      // Set headers
      if (config.headers) {
        for (const key in config.headers) {
          xhr.setRequestHeader(key, config.headers[key]);
        }
      }

      if (!isFormData && isJSON && !config.headers?.['Content-Type']) {
        xhr.setRequestHeader('Content-Type', 'application/json');
      }

      // Upload progress
      if (xhr.upload && config.onUploadProgress) {
        xhr.upload.onprogress = (event) => {
          const percent = event.lengthComputable
            ? (event.loaded / event.total) * 100
            : 0;
          config.onUploadProgress?.({
            loaded: event.loaded,
            total: event.lengthComputable ? event.total : undefined,
            percent,
          });
        };
      }

      // Download progress
      if (config.onDownloadProgress) {
        xhr.onprogress = (event) => {
          if (event.lengthComputable) {
            config.onDownloadProgress?.({
              loaded: event.loaded,
              total: event.total,
              percent: (event.loaded / event.total) * 100,
            });
          }
        };
      }

      // Track if request is already handled to prevent race conditions
      let isHandled = false;

      // Success
      xhr.onload = () => {
        if (isHandled) return;
        isHandled = true;
        
        // Clean up abort listener
        if (config.signal && abortHandler) {
          config.signal.removeEventListener('abort', abortHandler);
        }
        
        const headers = parseHeaders(xhr.getAllResponseHeaders());
        const contentType = xhr.getResponseHeader('Content-Type') || '';
        const status = xhr.status;

        let responseData: any;
        try {
          responseData = parseResponse(xhr, contentType);
        } catch (parseError: any) {
          return reject(buildError(
            parseError.message || 'Failed to parse response',
            config,
            'ERR_PARSE',
            xhr,
            { status, headers, data: xhr.responseText },
            status
          ));
        }

        const filename = safeExtractFilename(xhr);
        const response: HttpResponse<T> = {
          status,
          headers,
          data: responseData,
          ...(filename ? { filename } : {}),
        };

        const validateStatus = config.validateStatus || ((status) => status >= 200 && status < 300);

        if (validateStatus(status)) {
          resolve(response);
        } else {
          reject(buildError(
            `Request failed with status code ${status}`,
            config,
            null,
            xhr,
            response,
            status
          ));
        }
      };
      
      // Network error
      xhr.onerror = () => {
        if (isHandled) return;
        isHandled = true;
        
        // Clean up abort listener
        if (config.signal && abortHandler) {
          config.signal.removeEventListener('abort', abortHandler);
        }
        
        // Use retry (singular) to match interface, fallback to retries for backward compat
        const retryCount = config.retry ?? (config as any).retries ?? 0;
        if (attempt < retryCount) {
          return retryRequest();
        }
        reject(buildError('Network error', config, 'ERR_NETWORK', xhr));
      };

      // Timeout
      xhr.ontimeout = () => {
        if (isHandled) return;
        isHandled = true;
        
        // Clean up abort listener
        if (config.signal && abortHandler) {
          config.signal.removeEventListener('abort', abortHandler);
        }
        
        // Use retry (singular) to match interface, fallback to retries for backward compat
        const retryCount = config.retry ?? (config as any).retries ?? 0;
        if (attempt < retryCount) {
          return retryRequest();
        }
        reject(buildError(`Timeout of ${xhr.timeout}ms exceeded`, config, 'ECONNABORTED', xhr));
      };

      // Send body
      if (isGetLike) {
        xhr.send();
      } else if (isFormData) {
        xhr.send(config.body);
      } else if (isJSON && config.body) {
        xhr.send(JSON.stringify(config.body));
      } else {
        xhr.send();
      }

      function retryRequest() {
        // Abort current request before retrying to prevent memory leaks
        xhr.abort();
        
        // Clean up abort listener
        if (config.signal && abortHandler) {
          config.signal.removeEventListener('abort', abortHandler);
        }
        
        setTimeout(() => {
          makeRequest(attempt + 1).then(resolve).catch(reject);
        }, config.retryDelay ?? 500);
      }
    });
  };

  return makeRequest(0);
}

// ----------------------
// ✅ Utilities
// ----------------------

function buildError(
  message: string,
  config: HttpRequestConfig,
  code: string | null,
  request: XMLHttpRequest,
  response?: any,
  status?: number
) {
  const error = new Error(message) as any;
  error.config = config;
  error.code = code;
  error.request = request;
  if (response) error.response = response;
  if (status) error.status = status;
  return error;
}

function parseHeaders(headerStr: string): Record<string, string> {
  const headers: Record<string, string> = {};
  headerStr.trim().split(/[\r\n]+/).forEach(line => {
    const [key, ...rest] = line.split(': ');
    if (key) headers[key.toLowerCase()] = rest.join(': ');
  });
  return headers;
}

function parseResponse(xhr: XMLHttpRequest, contentType: string) {
  // Handle blob and arraybuffer response types
  if (xhr.responseType === 'blob' || xhr.responseType === 'arraybuffer') {
    return xhr.response;
  }
  
  // Handle binary content
  if (contentType.includes('application/octet-stream') || 
      contentType.includes('application/pdf') ||
      /^(image|audio|video)\//.test(contentType)) {
    // For binary content with text responseType, return as-is
    // User should set responseType='blob' or 'arraybuffer' for proper handling
    return xhr.responseText;
  }
  
  // Handle JSON
  if (contentType.includes('application/json') || contentType.includes('application/vnd.api+json')) {
    try {
      // Handle empty response
      if (!xhr.responseText || xhr.responseText.trim() === '') {
        return null;
      }
      return JSON.parse(xhr.responseText);
    } catch (parseError) {
      throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
  }
  
  // Default: return text
  return xhr.responseText;
}

function safeExtractFilename(xhr: XMLHttpRequest): string | undefined {
  try {
    const disposition = xhr.getResponseHeader('Content-Disposition');
    if (!disposition) return undefined;
    const match = /filename[^;=\n]*=(['"]?)([^'"\n]*)\1/.exec(disposition);
    return match ? decodeURIComponent(match[2]) : undefined;
  } catch {
    // Access will throw in browser unless the server exposes this header
    return undefined;
  }
}

