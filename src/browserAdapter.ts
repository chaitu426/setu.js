import { HttpRequestConfig, HttpResponse } from './coreRequest.js';
import { defaults } from './defaults.js';

export function browserAdapter<T = any>(
  url: string,
  config: HttpRequestConfig & {
    onUploadProgress?: (progress: { loaded: number; total?: number; percent: number }) => void;
    onDownloadProgress?: (progress: { loaded: number; total?: number; percent: number }) => void;
    retries?: number;
    retryDelay?: number;
    validateStatus?: (status: number) => boolean;
  } = {}
): Promise<HttpResponse<T>> {
  const makeRequest = (attempt: number): Promise<HttpResponse<T>> => {
    return new Promise((resolve, reject) => {
      const method = (config.method || 'GET').toUpperCase();
      const isGetLike = ['GET', 'HEAD'].includes(method);

      // Merge query params
      const [baseUrl, existingQuery] = url.split('?');
      const combinedParams = new URLSearchParams(existingQuery || '');
      if (config.params) {
        Object.entries(config.params).forEach(([key, value]) => {
          combinedParams.set(key, value as string);
        });
      }
      const finalUrl =
        (baseUrl.startsWith('http') ? baseUrl : defaults.baseURL + baseUrl) +
        (combinedParams.toString() ? '?' + combinedParams.toString() : '');

      const xhr = new XMLHttpRequest();
      xhr.open(method, finalUrl, true);

      if (config.timeout) xhr.timeout = config.timeout;
      if (config.responseType === 'blob') xhr.responseType = 'blob';

      if (config.signal) {
        config.signal.addEventListener('abort', () => {
          xhr.abort();
          reject(buildError('Request aborted', config, 'ECONNABORTED', xhr));
        });
      }

      const isFormData = config.body instanceof FormData;
      const isJSON = typeof config.body === 'object' && !isFormData;

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

      // Success
      xhr.onload = () => {
        const headers = parseHeaders(xhr.getAllResponseHeaders());
        const contentType = xhr.getResponseHeader('Content-Type') || '';
        const status = xhr.status;

        const response: HttpResponse<T> = {
          status,
          headers,
          data: parseResponse(xhr, contentType),
          ...(extractFilename(xhr) ? { filename: extractFilename(xhr) } : {}),
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
        if (attempt < (config.retries || 0)) {
          return retryRequest();
        }
        reject(buildError('Network error', config, 'ERR_NETWORK', xhr));
      };

      // Timeout
      xhr.ontimeout = () => {
        if (attempt < (config.retries || 0)) {
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
        setTimeout(() => {
          makeRequest(attempt + 1).then(resolve).catch(reject);
        }, config.retryDelay || 500);
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
  if (xhr.responseType === 'blob' || contentType.includes('application/octet-stream')) {
    return xhr.response;
  } else if (contentType.includes('application/json')) {
    try {
      return JSON.parse(xhr.responseText);
    } catch {
      throw new Error('Failed to parse JSON response');
    }
  } else {
    return xhr.responseText;
  }
}

function extractFilename(xhr: XMLHttpRequest): string | undefined {
  const disposition = xhr.getResponseHeader('Content-Disposition') || '';
  const match = /filename[^;=\n]*=(['"]?)([^'"\n]*)\1/.exec(disposition);
  return match ? decodeURIComponent(match[2]) : undefined;
}
