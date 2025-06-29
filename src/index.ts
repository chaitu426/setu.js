import {HttpRequestConfig, HttpResponse} from "./coreRequest";

export interface SetuClient {
  <T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  get: <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  post: <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  put: <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  patch: <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  delete: <T = any>(url: string, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  defaults: any;
}
