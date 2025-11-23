export function buildQuery(params: Record<string, any> = {}): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        // URLSearchParams handles null/undefined by converting to empty string
        searchParams.append(key, '');
      } else if (Array.isArray(value)) {
        // Handle arrays - append each value
        value.forEach(item => {
          searchParams.append(key, String(item));
        });
      } else if (typeof value === 'object') {
        // Stringify objects
        searchParams.append(key, JSON.stringify(value));
      } else {
        // Primitive types
        searchParams.append(key, String(value));
      }
    });
    
    const query = searchParams.toString();
    return query ? `?${query}` : '';
  }
  
  export function mergeHeaders(
    defaultHeaders: Record<string, string>,
    userHeaders: Record<string, string> = {}
  ): Record<string, string> {
    return { ...defaultHeaders, ...userHeaders };
  }