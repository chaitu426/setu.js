import { coreRequest } from '../nodeAdapter.js';
import { defaults } from '../defaults.js';
import { HttpRequestConfig, HttpResponse } from '../coreRequest.js';

type Adapter = typeof coreRequest;

const method = (m: string) => {
  return <T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> =>
    coreRequest(url, { ...config, method: m });
};

const setu = {
  get: method('GET'),
  post: method('POST'),
  put: method('PUT'),
  patch: method('PATCH'),
  delete: method('DELETE'),
  defaults
};

const client = (<T = any>(url: string, config?: HttpRequestConfig) => {
  return coreRequest(url, config);
}) as any;

Object.assign(client, setu);

export default client as import('../index.ts').SetuClient;
