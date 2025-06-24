import { HttpRequestConfig, HttpResponse } from './coreRequest.js';
import { defaults } from './defaults.js';

const isBrowser = typeof window !== 'undefined' && typeof window.fetch === 'function';

type Adapter = <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;

let adapter: Adapter;

(async () =>{
  if (isBrowser) {
    const { browserAdapter } = await import('./browserAdapter.js');
    adapter = browserAdapter;
  } else {
    const { coreRequest } = await import('./nodeAdapter.js');
    adapter = coreRequest;
  }
})();

// ✅ Define interface with function signature + methods
interface SetuClient {
  <T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  get: <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  post: <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  put: <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  patch: <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  delete: <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  defaults: typeof defaults;

}

// ✅ Build base function
const base: any = (url: string, config?: HttpRequestConfig) => adapter(url, config);

// ✅ Attach methods
base.get = (url: string, config?: HttpRequestConfig) => adapter(url, { ...config, method: 'GET' });
base.post = (url: string, config?: HttpRequestConfig) => adapter(url, { ...config, method: 'POST' });
base.put = (url: string, config?: HttpRequestConfig) => adapter(url, { ...config, method: 'PUT' });
base.patch = (url: string, config?: HttpRequestConfig) => adapter(url, { ...config, method: 'PATCH' });
base.delete = (url: string, config?: HttpRequestConfig) => adapter(url, { ...config, method: 'DELETE' });

base.defaults = defaults;
 

const setu: SetuClient = base;

export default setu;
