import { HttpRequestConfig, HttpResponse } from './coreRequest.js';
import { defaults } from './defaults.js';

const isBrowser = typeof window !== 'undefined' && typeof window.fetch === 'function';

type Adapter = <T = any>(
  url: string,
  config?: HttpRequestConfig
) => Promise<HttpResponse<T>>;

export interface SetuClient {
  <T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  get: <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  post: <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  put: <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  patch: <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  delete: <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  defaults: typeof defaults;
}

let adapterPromise: Promise<Adapter> | null = null;

function loadAdapter(): Promise<Adapter> {
  if (adapterPromise) return adapterPromise;

  adapterPromise = (async () => {
    try {
      if (isBrowser) {
        const { browserAdapter } = await import('./browserAdapter.js');
        if (typeof browserAdapter !== 'function') {
          throw new Error('Invalid browser adapter');
        }
        return browserAdapter;
      } else {
        const { coreRequest } = await import('./nodeAdapter.js');
        if (typeof coreRequest !== 'function') {
          throw new Error('Invalid node adapter');
        }
        return coreRequest;
      }
    } catch (err) {
      console.error('Failed to load adapter:', err);
      throw err;
    }
  })();

  return adapterPromise;
}

const methodNames = ['get', 'post', 'put', 'patch', 'delete'];

const setu = new Proxy(
  {},
  {
    get(_, prop) {
      if (prop === 'defaults') return defaults;

      if (methodNames.includes(prop as string)) {
        return async (url: string, config?: HttpRequestConfig) => {
          const adapter = await loadAdapter();
          return adapter(url, { ...config, method: (prop as string).toUpperCase() });
        };
      }

      return async (url: string, config?: HttpRequestConfig) => {
        const adapter = await loadAdapter();
        return adapter(url, config);
      };
    },
    apply(_, __, args: [string, HttpRequestConfig?]) {
      return loadAdapter().then((adapter) => adapter(...args));
    },
  }
);

export default setu as unknown as SetuClient;
