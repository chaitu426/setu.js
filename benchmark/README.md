# HTTP Client Benchmark Suite

Comprehensive benchmark suite comparing Setu.js with other popular HTTP clients.

## 🎯 What's Benchmarked

### Performance Tests
- **GET Requests** - Simple GET request performance (100 iterations)
- **POST Requests** - POST with JSON body performance (100 iterations)
- **Concurrent Requests** - Handling 50 simultaneous requests
- **Large Response** - Handling ~100KB JSON responses

### Feature Tests
- **Timeout Handling** - How clients handle request timeouts
- **Retry Mechanism** - Built-in retry support (Setu.js specific)
- **Error Handling** - Handling HTTP error responses (500, etc.)

## 📊 Clients Tested

- **Setu.js** - This library
- **Axios** - Popular HTTP client
- **node-fetch** - Lightweight fetch implementation
- **undici** - Fast HTTP client (Node.js)
- **Native Fetch** - Built-in fetch (Node 18+)
- **got** - Human-friendly HTTP client (optional)

## 🚀 Quick Start

### Run All Benchmarks

```bash
npm run benchmark
```

This will:
1. Build the TypeScript code
2. Start a test server
3. Run all benchmarks for each client
4. Display comprehensive results

### Run Test Server Separately

```bash
npm run benchmark:server
```

Then in another terminal:
```bash
node benchmark/index.js
```

## 📈 Understanding Results

### Metrics

- **avgTime** - Average response time in milliseconds
- **minTime** - Fastest request time
- **maxTime** - Slowest request time
- **p50/p95/p99** - Percentiles (median, 95th, 99th percentile)
- **successRate** - Percentage of successful requests
- **totalTime** - Total time for concurrent requests

### Rankings

Results are sorted by performance (fastest first):
- 🥇 Gold - Best performance
- 🥈 Silver - Second best
- 🥉 Bronze - Third best

## 🧪 Test Endpoints

The benchmark uses a local test server with these endpoints:

- `GET /test/get` - Simple GET request
- `POST /test/post` - POST with JSON body
- `GET /test/slow` - Slow response (2 seconds)
- `GET /test/timeout` - Never responds (for timeout tests)
- `GET /test/error` - Returns 500 error
- `GET /test/retry?attempt=N` - Fails first 2 attempts
- `GET /test/large` - Large JSON response (~100KB)

## 📝 Example Output

```
🚀 Starting HTTP Client Benchmark Suite
================================================================================

Starting test server...
Test server started!

Testing 5 HTTP clients: Setu.js, Axios, node-fetch, undici, Native Fetch

============================================================
Running benchmarks for: Setu.js
============================================================

📊 Running GET request benchmark...
   ✅ Avg: 12.45ms | Success: 100.0%

📊 Running POST request benchmark...
   ✅ Avg: 15.23ms | Success: 100.0%

...

🏆 OVERALL PERFORMANCE RANKING
--------------------------------------------------------------------------------
   🥇 Setu.js         12.34ms avg
   🥈 undici          13.45ms avg
   🥉 Native Fetch    14.56ms avg
```

## 🔧 Customization

### Modify Iterations

Edit `benchmark/benchmarks.js` to change iteration counts:

```javascript
await benchmarks.benchmarkGet(clientName, 200); // 200 iterations instead of 100
```

### Add Custom Tests

Add new benchmark functions in `benchmark/benchmarks.js`:

```javascript
export async function benchmarkCustom(clientName) {
  // Your custom benchmark
}
```

Then call it in `benchmark/runner.js`:

```javascript
const customResult = await benchmarks.benchmarkCustom(clientName);
```

## 📦 Dependencies

Benchmark dependencies (devDependencies):
- `axios` - HTTP client
- `node-fetch` - Fetch implementation
- `undici` - Fast HTTP client
- `got` - Optional HTTP client

## 🐛 Troubleshooting

### Port Already in Use

If port 3001 is already in use, modify `benchmark/test-server.js`:

```javascript
const PORT = 3002; // Change port
```

And update `benchmark/clients.js`:

```javascript
const BASE_URL = 'http://localhost:3002';
```

### Build Errors

Make sure to build before running:

```bash
npm run build
npm run benchmark
```

### Client Not Found

If a client fails to load, check:
1. Dependencies are installed: `npm install`
2. Build is up to date: `npm run build`
3. Client is properly imported in `benchmark/clients.js`

## 📊 Interpreting Results

### Speed
- Lower times = Better performance
- Compare avgTime across clients
- Check p95/p99 for worst-case scenarios

### Reliability
- Higher successRate = More reliable
- Check error handling results
- Verify timeout behavior

### Features
- Built-in retry (Setu.js advantage)
- Timeout support
- Error handling consistency

## 🎓 Best Practices

1. **Run multiple times** - Network conditions vary
2. **Warm up** - First run may be slower
3. **Compare fairly** - Same conditions for all clients
4. **Check features** - Speed isn't everything

## 📄 License

Same as Setu.js - MIT License

