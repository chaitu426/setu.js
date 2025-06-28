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
    const finalUrl = new URL(url.startsWith('http') ? url : defaults.baseURL + url);
    if (config.params) finalUrl.search = buildQuery(config.params);

    const lib = finalUrl.protocol === 'https:' ? https : http;
    const headers = mergeHeaders(defaults.headers, config.headers);
    const method = config.method || 'GET';

    let body = config.body;
    let isForm = false;

    if (body instanceof FormData) {
      isForm = true;
      Object.assign(headers, body.getHeaders());
    } else if (body && typeof body === 'object' && !(body instanceof Buffer)) {
      body = JSON.stringify(body);
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body).toString();
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
        const buffer = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';
        const status = res.statusCode || 200;

        let parsed: any;
        const isBinary = config.responseType === 'blob' ||
          config.responseType === 'arraybuffer' ||
          isBinaryContentType(contentType);

        try {
          if (isBinary) {
            parsed = buffer;
          } else if (contentType.includes('application/json')) {
            parsed = JSON.parse(buffer.toString('utf-8'));
          } else {
            parsed = buffer.toString('utf-8');
          }
        } catch (err) {
          return reject(buildError('Failed to parse response', config, null, req, {
            status,
            headers: res.headers,
            data: buffer.toString('utf-8'),
          }, status));
        }

        const response: HttpResponse<T> = {
          status,
          headers: res.headers as any,
          data: parsed as T,
        };

        const validateStatus = config.validateStatus || ((status) => status >= 200 && status < 300);

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

      res.on('error', (err) => {
        reject(buildError('Response stream error', config, 'ERR_RESPONSE', req, null));
      });
    });

    req.on('error', (err) => {
      reject(buildError(err.message, config, 'ERR_NETWORK', req));
    });

    const timeout = reqOptions.timeout || defaults.timeout;
    req.on('timeout', () => {
      req.destroy();
      reject(buildError(`Timeout of ${timeout}ms exceeded`, config, 'ECONNABORTED', req));
    });

    if (config.signal) {
      config.signal.addEventListener('abort', () => {
        req.destroy();
        reject(buildError('Request aborted', config, 'ECONNABORTED', req));
      });
    }

    // Upload body
    if (isForm) {
      let uploaded = 0;
      body.on('data', (chunk: Buffer) => {
        uploaded += chunk.length;
        config.onUploadProgress?.({
          loaded: uploaded,
          total: undefined,
          percent: uploaded / (body.getLengthSync() || 1) * 100,
        });
      });

      body.on('error', (err: Error) => {
        reject(buildError(err.message, config, 'ERR_UPLOAD_STREAM', req));
      });

      body.pipe(req);
    } else if (body) {
      req.write(body);
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
