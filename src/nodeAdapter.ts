import http from 'http';
import https from 'https';
import { URL } from 'url';
import FormData from 'form-data';
import { defaults } from './defaults.js';
import { buildQuery, mergeHeaders } from './utils.js';
import { HttpRequestConfig, HttpResponse } from './coreRequest.js';

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function isBinaryContentType(contentType: string): boolean {
  return /(application|image|audio|video|octet-stream)/i.test(contentType) &&
    !/json|text|xml/i.test(contentType);
}

export async function coreRequest<T = any>(
  url: string,
  config: HttpRequestConfig = {}
): Promise<HttpResponse<T>> {
  const attempts = config.retry ?? 0;
  const delayMs = config.retryDelay ?? 300;
  let lastError: any;

  for (let i = 0; i <= attempts; i++) {
    try {
      return await makeRequest<T>(url, config);
    } catch (err: any) {
      lastError = err;
      if (i < attempts) await delay(delayMs);
    }
  }

  throw lastError;
}

function makeRequest<T>(url: string, config: HttpRequestConfig): Promise<HttpResponse<T>> {
  return new Promise((resolve, reject) => {
    // Build URL with proper error handling
    let finalUrl: URL;
    try {
      // Handle URL construction - check for absolute URLs
      let urlToUse = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (!defaults.baseURL) {
          return reject(buildError(
            'Invalid URL: relative URL provided but no baseURL is set',
            config,
            'ERR_INVALID_URL',
            null
          ));
        }
        // Ensure proper joining
        const base = defaults.baseURL.endsWith('/') ? defaults.baseURL.slice(0, -1) : defaults.baseURL;
        const path = url.startsWith('/') ? url : '/' + url;
        urlToUse = base + path;
      }
      finalUrl = new URL(urlToUse);
    } catch (urlError: any) {
      return reject(buildError(
        `Invalid URL: ${urlError.message}`,
        config,
        'ERR_INVALID_URL',
        null
      ));
    }
    
    // Handle query params - buildQuery returns '?params' or '', but URL.search expects just the query string
    if (config.params) {
      const queryString = buildQuery(config.params);
      // buildQuery returns '?params' or '', so remove the '?' if present
      finalUrl.search = queryString.startsWith('?') ? queryString.slice(1) : queryString;
    }

    const lib = finalUrl.protocol === 'https:' ? https : http;
    const headers = mergeHeaders(defaults.headers, config.headers);
    const method = config.method || 'GET';

    let body = config.body;
    let isForm = false;

    if (body instanceof FormData) {
      isForm = true;
      Object.assign(headers, body.getHeaders());
    } else if (body !== null && body !== undefined) {
      // Handle different body types
      if (body instanceof Buffer) {
        // Buffer - set Content-Length
        headers['Content-Length'] = body.length.toString();
      } else if (typeof body === 'string') {
        // String - set Content-Length
        headers['Content-Length'] = Buffer.byteLength(body, 'utf8').toString();
      } else if (typeof body === 'object') {
        // Object (but not FormData, Buffer, or null) - stringify as JSON
        try {
          body = JSON.stringify(body);
          headers['Content-Type'] = headers['Content-Type'] || 'application/json';
          headers['Content-Length'] = Buffer.byteLength(body, 'utf8').toString();
        } catch (stringifyError: any) {
          return reject(buildError(
            `Failed to stringify request body: ${stringifyError.message}`,
            config,
            'ERR_BODY_STRINGIFY',
            null
          ));
        }
      }
      // For other types (number, boolean, etc.), convert to string
      else {
        body = String(body);
        headers['Content-Length'] = Buffer.byteLength(body, 'utf8').toString();
      }
    }

    const reqOptions: http.RequestOptions = {
      method,
      headers,
      timeout: config.timeout || defaults.timeout,
    };

    const req = lib.request(finalUrl, reqOptions, (res) => {
      const total = parseInt(res.headers['content-length'] || '0');
      let downloaded = 0;

      if (config.responseType === 'stream') {
        return resolve({
          status: res.statusCode || 200,
          headers: res.headers as any,
          data: res as any,
        });
      }

      const chunks: Buffer[] = [];
      res.setEncoding(null as any);

      res.on('data', (chunk: Buffer) => {
        const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(bufferChunk);
        downloaded += bufferChunk.length;

        if (config.onDownloadProgress && total > 0) {
          config.onDownloadProgress({
            loaded: downloaded,
            total,
            percent: (downloaded / total) * 100,
          });
        }
      });

      res.on('end', () => {
        // Handle empty response body
        const buffer = chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
        const contentType = res.headers['content-type'] || '';
        const status = res.statusCode || 200;

        let parsed: any;
        const isBinary = config.responseType === 'blob' ||
          config.responseType === 'arraybuffer' ||
          isBinaryContentType(contentType);

        try {
          if (isBinary) {
            parsed = buffer;
          } else if (config.responseType === 'stream') {
            // Should have been handled earlier, but just in case
            parsed = buffer;
          } else if (contentType.includes('application/json') || 
                     contentType.includes('application/vnd.api+json')) {
            // Handle empty JSON response
            if (buffer.length === 0) {
              parsed = null;
            } else {
              parsed = JSON.parse(buffer.toString('utf-8'));
            }
          } else {
            parsed = buffer.toString('utf-8');
          }
        } catch (err: any) {
          return reject(buildError(
            `Failed to parse response: ${err.message || 'Unknown error'}`,
            config,
            'ERR_PARSE',
            req,
            {
              status,
              headers: res.headers,
              data: buffer.length > 0 ? buffer.toString('utf-8') : '',
            },
            status
          ));
        }

        const response: HttpResponse<T> = {
          status,
          headers: res.headers as any,
          data: parsed as T,
        };

        const validateStatus = config.validateStatus || ((status) => status >= 200 && status < 300);

        // Clean up abort listener on successful response parsing
        if (config.signal && abortHandler) {
          config.signal.removeEventListener('abort', abortHandler);
        }
        
        if (validateStatus(status)) {
          resolve(response);
        } else {
          reject(buildError(
            `Request failed with status code ${status}`,
            config,
            null,
            req,
            response,
            status
          ));
        }
      });

      let responseErrorHandled = false;
      res.on('error', (err) => {
        if (responseErrorHandled) return;
        responseErrorHandled = true;
        
        // Clean up abort listener
        if (config.signal && abortHandler) {
          config.signal.removeEventListener('abort', abortHandler);
        }
        
        reject(buildError(
          `Response stream error: ${err.message || 'Unknown error'}`,
          config,
          'ERR_RESPONSE',
          req,
          null
        ));
      });
    });

    let requestErrorHandled = false;
    req.on('error', (err) => {
      if (requestErrorHandled) return;
      requestErrorHandled = true;
      
      // Clean up abort listener
      if (config.signal && abortHandler) {
        config.signal.removeEventListener('abort', abortHandler);
      }
      
      reject(buildError(err.message, config, 'ERR_NETWORK', req));
    });

    const timeout = reqOptions.timeout || defaults.timeout;
    let timeoutHandled = false;
    
    req.on('timeout', () => {
      if (timeoutHandled) return;
      timeoutHandled = true;
      req.destroy();
      reject(buildError(`Timeout of ${timeout}ms exceeded`, config, 'ECONNABORTED', req));
    });

    // Track abort handler for cleanup
    let abortHandler: (() => void) | null = null;
    if (config.signal) {
      abortHandler = () => {
        if (timeoutHandled) return;
        timeoutHandled = true;
        req.destroy();
        reject(buildError('Request aborted', config, 'ECONNABORTED', req));
      };
      config.signal.addEventListener('abort', abortHandler);
    }

    // Upload body
    if (isForm) {
      let uploaded = 0;
      let formErrorHandled = false;
      
      body.on('data', (chunk: Buffer) => {
        uploaded += chunk.length;
        try {
          const totalLength = body.getLengthSync();
          config.onUploadProgress?.({
            loaded: uploaded,
            total: totalLength || undefined,
            percent: totalLength ? (uploaded / totalLength) * 100 : 0,
          });
        } catch (lengthError) {
          // getLengthSync might fail for some FormData, use undefined total
          config.onUploadProgress?.({
            loaded: uploaded,
            total: undefined,
            percent: 0,
          });
        }
      });

      body.on('error', (err: Error) => {
        if (formErrorHandled) return;
        formErrorHandled = true;
        
        // Clean up abort listener
        if (config.signal && abortHandler) {
          config.signal.removeEventListener('abort', abortHandler);
        }
        
        reject(buildError(err.message, config, 'ERR_UPLOAD_STREAM', req));
      });

      body.pipe(req);
    } else if (body !== null && body !== undefined) {
      // Write body and end request
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        req.write(body);
      } else {
        // For other types, convert to string
        req.write(String(body));
      }
      req.end();
    } else {
      req.end();
    }
  });
}

// ✅ Structured error generator
function buildError(
  message: string,
  config: HttpRequestConfig,
  code: string | null,
  request: any,
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
