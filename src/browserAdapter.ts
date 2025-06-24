import { HttpRequestConfig, HttpResponse } from './coreRequest.js';
import { defaults } from './defaults.js';

export function browserAdapter<T = any>(
  url: string,
  config: HttpRequestConfig & {
    onUploadProgress?: (progress: { loaded: number; total?: number; percent: number }) => void;
    onDownloadProgress?: (progress: { loaded: number; total?: number; percent: number }) => void;
    retries?: number;
    retryDelay?: number;
  } = {}
): Promise<HttpResponse<T>> {
  const makeRequest = (attempt: number): Promise<HttpResponse<T>> => {
    return new Promise((resolve, reject) => {
      const method = (config.method || 'GET').toUpperCase();
      const isGetLike = ['GET', 'HEAD'].includes(method);

      // ✅ Merge query params from config.params and url
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
          reject(new Error('Request aborted'));
        });
      }

      const isFormData = config.body instanceof FormData;
      const isJSON = typeof config.body === 'object' && !isFormData;

      // ✅ Headers setup
      if (config.headers) {
        for (const key in config.headers) {
          xhr.setRequestHeader(key, config.headers[key]);
        }
      }

      // ⚠️ Set Content-Type only if not FormData
      if (!isFormData && isJSON && !config.headers?.['Content-Type']) {
        xhr.setRequestHeader('Content-Type', 'application/json');
      }

      // 📤 Upload progress
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

      // 📥 Download progress
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

      xhr.onload = () => {
        const headers: Record<string, string> = {};
        xhr.getAllResponseHeaders().trim().split(/[\r\n]+/).forEach(line => {
          const parts = line.split(': ');
          const header = parts.shift();
          const value = parts.join(': ');
          if (header) headers[header.toLowerCase()] = value;
        });

        const contentType = xhr.getResponseHeader('Content-Type') || '';
        const disposition = xhr.getResponseHeader('Content-Disposition') || '';

        let filename: string | undefined;
        const match = /filename[^;=\n]*=(['"]?)([^'"\n]*)\1/.exec(disposition);
        if (match) filename = decodeURIComponent(match[2]);

        let data: any;
        if (xhr.responseType === 'blob' || contentType.includes('application/octet-stream')) {
          data = xhr.response;
        } else if (contentType.includes('application/json')) {
          try {
            data = JSON.parse(xhr.responseText);
          } catch {
            return reject(new Error('Failed to parse JSON'));
          }
        } else {
          data = xhr.responseText;
        }

        resolve({
          status: xhr.status,
          headers,
          data,
          ...(filename ? { filename } : {}),
        } as HttpResponse<T> & { filename?: string });
      };

      xhr.onerror = () => {
        if (attempt < (config.retries || 0)) {
          setTimeout(() => {
            makeRequest(attempt + 1).then(resolve).catch(reject);
          }, config.retryDelay || 500);
        } else {
          reject(new Error('Network error'));
        }
      };

      xhr.ontimeout = () => {
        if (attempt < (config.retries || 0)) {
          setTimeout(() => {
            makeRequest(attempt + 1).then(resolve).catch(reject);
          }, config.retryDelay || 500);
        } else {
          reject(new Error('Request timed out'));
        }
      };

      // ✅ Send the body
      if (isGetLike) {
        xhr.send();
      } else if (isFormData) {
        xhr.send(config.body);
      } else if (isJSON && config.body) {
        xhr.send(JSON.stringify(config.body));
      } else {
        xhr.send();
      }
    });
  };

  return makeRequest(0);
}
