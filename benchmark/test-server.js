import http from 'http';
import { URL } from 'url';

const PORT = 3001;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Test endpoints
  if (path === '/test/get' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'GET request successful' }));
    return;
  }

  if (path === '/test/post' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, received: JSON.parse(body || '{}') }));
    });
    return;
  }

  if (path === '/test/slow' && method === 'GET') {
    // Simulate slow response (2 seconds)
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Slow response' }));
    }, 2000);
    return;
  }

  if (path === '/test/timeout' && method === 'GET') {
    // Never respond - for timeout testing
    // Don't send response
    return;
  }

  if (path === '/test/error' && method === 'GET') {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
    return;
  }

  if (path === '/test/retry' && method === 'GET') {
    // Simple per-request tracking using a Map with request identifiers
    // Since each retry is a new HTTP request, we use a simple counter
    // that resets periodically. For a single test run, this works fine.
    if (!global.retryCounter) {
      global.retryCounter = 0;
      global.retryLastReset = Date.now();
    }
    
    // Reset counter if more than 2 seconds have passed (allows new test runs)
    if (Date.now() - global.retryLastReset > 2000) {
      global.retryCounter = 0;
      global.retryLastReset = Date.now();
    }
    
    global.retryCounter++;
    
    // Fail first 2 requests, succeed on 3rd+
    // Setu.js with retry: 2 means 3 total attempts (initial + 2 retries)
    // So: attempt 1 fails, attempt 2 fails, attempt 3 succeeds
    if (global.retryCounter <= 2) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Retry attempt failed', 
        attempt: global.retryCounter,
        message: `This is attempt ${global.retryCounter}, will succeed on attempt 3`
      }));
      return;
    }
    
    // Success on 3rd+ request
    const successAttempt = global.retryCounter;
    // Reset for next test
    global.retryCounter = 0;
    global.retryLastReset = Date.now();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      attempt: successAttempt,
      message: `Succeeded on attempt ${successAttempt}`
    }));
    return;
  }

  if (path === '/test/large' && method === 'GET') {
    // Return large JSON response (~100KB)
    const largeData = { data: Array(10000).fill(0).map((_, i) => ({ id: i, value: `item-${i}` })) };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(largeData));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /test/get     - Simple GET request');
  console.log('  POST /test/post    - POST with JSON body');
  console.log('  GET  /test/slow    - Slow response (2s)');
  console.log('  GET  /test/timeout - Never responds (for timeout tests)');
  console.log('  GET  /test/error   - Returns 500 error');
  console.log('  GET  /test/retry   - Fails first 2 attempts');
  console.log('  GET  /test/large   - Large JSON response (~100KB)');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Test server closed');
    process.exit(0);
  });
});

