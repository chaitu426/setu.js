export interface HttpRequestConfig {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, any>;
  timeout?: number;
  retry?: number;
  retryDelay?: number;
  signal?: AbortSignal;
  responseType?: 'json' | 'text' | 'blob' | 'stream' | 'arraybuffer' | 'document';

  onUploadProgress?: (progress: { loaded: number; total?: number; percent: number }) => void;
  onDownloadProgress?: (progress: { loaded: number; total?: number; percent: number }) => void;
  validateStatus?: (status: number) => boolean; // Added validateStatus property
}

export interface HttpResponse<T = any> {
  status: number;
  headers: Record<string, string>;
  data: T;
  filename?: string;
}
