import { clients } from './clients.js';
import setu from '../dist/node/index.js';

// Utility to measure execution time
async function measureTime(fn) {
  const start = performance.now();
  try {
    const result = await fn();
    const end = performance.now();
    return { success: true, time: end - start, result };
  } catch (error) {
    const end = performance.now();
    // Extract error message - handle different error formats
    const errorMsg = error?.message || error?.toString() || String(error) || 'Unknown error';
    return { success: false, time: end - start, error: errorMsg, errorObj: error };
  }
}

// Utility to run multiple iterations
async function runIterations(fn, iterations = 100) {
  const results = [];
  for (let i = 0; i < iterations; i++) {
    const result = await measureTime(fn);
    results.push(result);
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return results;
}

// Benchmark: Simple GET request
export async function benchmarkGet(clientName, iterations = 100) {
  const client = clients[clientName];
  if (!client) throw new Error(`Client ${clientName} not found`);

  const results = await runIterations(
    () => client.get('/test/get'),
    iterations
  );

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const times = successful.map(r => r.time);

  return {
    client: clientName,
    test: 'GET Request',
    iterations,
    successful: successful.length,
    failed: failed.length,
    successRate: (successful.length / iterations) * 100,
    avgTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
    minTime: times.length > 0 ? Math.min(...times) : 0,
    maxTime: times.length > 0 ? Math.max(...times) : 0,
    p50: percentile(times, 50),
    p95: percentile(times, 95),
    p99: percentile(times, 99),
  };
}

// Benchmark: POST request with JSON body
export async function benchmarkPost(clientName, iterations = 100) {
  const client = clients[clientName];
  if (!client) throw new Error(`Client ${clientName} not found`);

  const testBody = { name: 'Test', value: 123, items: [1, 2, 3] };
  const results = await runIterations(
    () => client.post('/test/post', testBody),
    iterations
  );

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const times = successful.map(r => r.time);

  return {
    client: clientName,
    test: 'POST Request',
    iterations,
    successful: successful.length,
    failed: failed.length,
    successRate: (successful.length / iterations) * 100,
    avgTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
    minTime: times.length > 0 ? Math.min(...times) : 0,
    maxTime: times.length > 0 ? Math.max(...times) : 0,
    p50: percentile(times, 50),
    p95: percentile(times, 95),
    p99: percentile(times, 99),
  };
}

// Benchmark: Concurrent requests
export async function benchmarkConcurrent(clientName, concurrency = 50) {
  const client = clients[clientName];
  if (!client) throw new Error(`Client ${clientName} not found`);

  const start = performance.now();
  const promises = Array(concurrency).fill(null).map(() => client.get('/test/get'));
  const results = await Promise.allSettled(promises);
  const end = performance.now();

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  const totalTime = end - start;

  return {
    client: clientName,
    test: 'Concurrent Requests',
    concurrency,
    successful,
    failed,
    successRate: (successful / concurrency) * 100,
    totalTime,
    avgTimePerRequest: totalTime / concurrency,
  };
}

// Benchmark: Large response handling
export async function benchmarkLargeResponse(clientName, iterations = 10) {
  const client = clients[clientName];
  if (!client) throw new Error(`Client ${clientName} not found`);

  const results = await runIterations(
    () => client.get('/test/large'),
    iterations
  );

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const times = successful.map(r => r.time);

  return {
    client: clientName,
    test: 'Large Response (~100KB)',
    iterations,
    successful: successful.length,
    failed: failed.length,
    successRate: (successful.length / iterations) * 100,
    avgTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
    minTime: times.length > 0 ? Math.min(...times) : 0,
    maxTime: times.length > 0 ? Math.max(...times) : 0,
  };
}

// Benchmark: Timeout handling
export async function benchmarkTimeout(clientName, timeoutMs = 1000) {
  const client = clients[clientName];
  if (!client) throw new Error(`Client ${clientName} not found`);

  if (!client.supportsTimeout) {
    return {
      client: clientName,
      test: 'Timeout Handling',
      skipped: true,
      reason: 'Client does not support timeout',
    };
  }

  const results = await runIterations(
    () => client.get('/test/timeout', { timeout: timeoutMs }),
    10
  );

  const timedOut = results.filter(r => {
    if (r.success) return false;
    const errorLower = (r.error || '').toLowerCase();
    return errorLower.includes('timeout') || 
           errorLower.includes('abort') ||
           errorLower.includes('exceeded') ||
           errorLower.includes('econnaborted') ||
           r.errorObj?.code === 'ECONNABORTED';
  });
  const otherErrors = results.filter(r => !r.success && !timedOut.includes(r));

  return {
    client: clientName,
    test: 'Timeout Handling',
    timeout: timeoutMs,
    iterations: 10,
    timedOut: timedOut.length,
    otherErrors: otherErrors.length,
    successRate: (timedOut.length / 10) * 100, // Success = correctly timed out
  };
}

// Benchmark: Retry mechanism (Setu.js specific)
export async function benchmarkRetry(clientName) {
  const client = clients[clientName];
  if (!client) throw new Error(`Client ${clientName} not found`);

  if (!client.supportsRetry) {
    return {
      client: clientName,
      test: 'Retry Mechanism',
      skipped: true,
      reason: 'Client does not support built-in retry',
    };
  }

  // Test retry with Setu.js
  if (clientName === 'Setu.js') {
    const start = performance.now();
    try {
      // IMPORTANT: Call Setu.js directly, not through client wrapper
      // The wrapper catches errors and returns responses, which prevents retry from working
      // Setu.js retry logic: retry: N means (N+1) total attempts
      // Server fails first 2 requests, succeeds on 3rd
      // So we need retry: 2 (which gives 3 attempts: initial + 2 retries)
      // Attempt 1: fails (500) → retry
      // Attempt 2: fails (500) → retry  
      // Attempt 3: succeeds (200) ✓
      const result = await setu.get('http://localhost:3001/test/retry', {
        retry: 2,  // 2 retries = 3 total attempts (initial + 2 retries)
        retryDelay: 100,
      });
      const end = performance.now();
      return {
        client: clientName,
        test: 'Retry Mechanism',
        success: result.status === 200,
        attempts: 3,
        time: end - start,
      };
    } catch (error) {
      // If error has response, check if it's a retry failure
      if (error.response && error.response.status === 500) {
        // Retry didn't work - all attempts failed
        return {
          client: clientName,
          test: 'Retry Mechanism',
          success: false,
          error: `All retry attempts failed: ${error.message || 'Unknown error'}`,
        };
      }
      return {
        client: clientName,
        test: 'Retry Mechanism',
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  return {
    client: clientName,
    test: 'Retry Mechanism',
    skipped: true,
    reason: 'Retry not implemented for this client',
  };
}

// Benchmark: Error handling
export async function benchmarkErrorHandling(clientName, iterations = 50) {
  const client = clients[clientName];
  if (!client) throw new Error(`Client ${clientName} not found`);

  const results = await runIterations(
    () => client.get('/test/error'),
    iterations
  );

  const handled = results.filter(r => r.success && r.result?.status === 500);
  const unhandled = results.filter(r => !r.success);

  return {
    client: clientName,
    test: 'Error Handling',
    iterations,
    handled: handled.length,
    unhandled: unhandled.length,
    successRate: (handled.length / iterations) * 100,
  };
}

// Helper: Calculate percentile
function percentile(arr, p) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] || 0;
}

