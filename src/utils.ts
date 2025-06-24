export function buildQuery(params: Record<string, any> = {}): string {
    const query = new URLSearchParams(params).toString();
    return query ? `?${query}` : '';
  }
  
  export function mergeHeaders(
    defaultHeaders: Record<string, string>,
    userHeaders: Record<string, string> = {}
  ): Record<string, string> {
    return { ...defaultHeaders, ...userHeaders };
  }