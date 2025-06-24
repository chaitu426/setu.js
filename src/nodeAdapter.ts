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
      Object.assign(headers, body.getHeaders()); // Don't set Content-Length manually
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

      // ✅ Stream Response
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
        let parsed: any;

        const isBinary = config.responseType === 'blob' ||
                         config.responseType === 'arraybuffer' ||
                         isBinaryContentType(contentType);

        if (isBinary) {
          parsed = buffer;
        } else if (contentType.includes('application/json')) {
          try {
            parsed = JSON.parse(buffer.toString('utf-8'));
          } catch (e) {
            parsed = buffer.toString('utf-8');
          }
        } else {
          parsed = buffer.toString('utf-8');
        }

        resolve({
          status: res.statusCode || 200,
          headers: res.headers as any,
          data: parsed as T,
        });
      });

      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (config.signal) {
      config.signal.addEventListener('abort', () => {
        req.destroy();
        reject(new Error('Request aborted'));
      });
    }

    // ✅ Write Body
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

      body.on('error', reject);
      body.pipe(req);
    } else if (body) {
      req.write(body);
      req.end();
    } else {
      req.end();
    }
  });
}
