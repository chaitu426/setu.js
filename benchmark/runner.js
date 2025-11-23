import { spawn } from 'child_process';
import { clients, initializeClients } from './clients.js';
import * as benchmarks from './benchmarks.js';

const RESULTS = [];

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Check if test server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3001/test/get');
    return response.ok;
  } catch {
    return false;
  }
}

// Start test server
function startServer() {
  return new Promise((resolve, reject) => {
    log('Starting test server...', 'cyan');
    const server = spawn('node', ['benchmark/test-server.js'], {
      stdio: 'pipe',
      cwd: process.cwd(),
    });

    let serverReady = false;
    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Test server running')) {
        serverReady = true;
        log('Test server started!', 'green');
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      console.error(`Server error: ${data}`);
    });

    // Wait a bit for server to be ready
    setTimeout(async () => {
      if (await checkServer()) {
        if (!serverReady) resolve(server);
      } else {
        reject(new Error('Server failed to start'));
      }
    }, 2000);
  });
}

// Run all benchmarks for a client
async function runBenchmarksForClient(clientName) {
  log(`\n${'='.repeat(60)}`, 'bright');
  log(`Running benchmarks for: ${clientName}`, 'bright');
  log('='.repeat(60), 'bright');

  const results = { client: clientName, tests: [] };

  // GET benchmark
  try {
    log('\n📊 Running GET request benchmark...', 'blue');
    const getResult = await benchmarks.benchmarkGet(clientName, 100);
    results.tests.push(getResult);
    log(`   ✅ Avg: ${getResult.avgTime.toFixed(2)}ms | Success: ${getResult.successRate.toFixed(1)}%`, 'green');
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
  }

  // POST benchmark
  try {
    log('\n📊 Running POST request benchmark...', 'blue');
    const postResult = await benchmarks.benchmarkPost(clientName, 100);
    results.tests.push(postResult);
    log(`   ✅ Avg: ${postResult.avgTime.toFixed(2)}ms | Success: ${postResult.successRate.toFixed(1)}%`, 'green');
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
  }

  // Concurrent requests
  try {
    log('\n📊 Running concurrent requests benchmark...', 'blue');
    const concurrentResult = await benchmarks.benchmarkConcurrent(clientName, 50);
    results.tests.push(concurrentResult);
    log(`   ✅ Total: ${concurrentResult.totalTime.toFixed(2)}ms | Avg per request: ${concurrentResult.avgTimePerRequest.toFixed(2)}ms`, 'green');
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
  }

  // Large response
  try {
    log('\n📊 Running large response benchmark...', 'blue');
    const largeResult = await benchmarks.benchmarkLargeResponse(clientName, 10);
    results.tests.push(largeResult);
    log(`   ✅ Avg: ${largeResult.avgTime.toFixed(2)}ms`, 'green');
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
  }

  // Timeout handling
  try {
    log('\n📊 Running timeout handling benchmark...', 'blue');
    const timeoutResult = await benchmarks.benchmarkTimeout(clientName, 1000);
    if (timeoutResult.skipped) {
      log(`   ⏭️  Skipped: ${timeoutResult.reason}`, 'yellow');
    } else {
      results.tests.push(timeoutResult);
      log(`   ✅ Timeout success rate: ${timeoutResult.successRate.toFixed(1)}%`, 'green');
    }
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
  }

  // Retry mechanism
  try {
    log('\n📊 Running retry mechanism benchmark...', 'blue');
    const retryResult = await benchmarks.benchmarkRetry(clientName);
    if (retryResult.skipped) {
      log(`   ⏭️  Skipped: ${retryResult.reason}`, 'yellow');
    } else {
      results.tests.push(retryResult);
      log(`   ✅ Retry test: ${retryResult.success ? 'PASSED' : 'FAILED'}`, retryResult.success ? 'green' : 'red');
    }
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
  }

  // Error handling
  try {
    log('\n📊 Running error handling benchmark...', 'blue');
    const errorResult = await benchmarks.benchmarkErrorHandling(clientName, 50);
    results.tests.push(errorResult);
    log(`   ✅ Error handling rate: ${errorResult.successRate.toFixed(1)}%`, 'green');
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
  }

  RESULTS.push(results);
}

// Generate comparison report
function generateReport() {
  log('\n\n' + '='.repeat(80), 'bright');
  log('BENCHMARK RESULTS SUMMARY', 'bright');
  log('='.repeat(80) + '\n', 'bright');

  // Group by test type
  const testTypes = ['GET Request', 'POST Request', 'Concurrent Requests', 'Large Response', 'Timeout Handling', 'Retry Mechanism', 'Error Handling'];
  
  testTypes.forEach(testType => {
    log(`\n📈 ${testType}`, 'cyan');
    log('-'.repeat(80), 'reset');
    
    const testResults = RESULTS
      .flatMap(r => r.tests.filter(t => t.test === testType))
      .filter(t => !t.skipped)
      .sort((a, b) => {
        // For timeout/error handling, sort by success rate (higher is better)
        if (testType === 'Timeout Handling' || testType === 'Error Handling') {
          const aRate = a.successRate || 0;
          const bRate = b.successRate || 0;
          return bRate - aRate;
        }
        // For retry, sort by success (true first)
        if (testType === 'Retry Mechanism') {
          if (a.success === b.success) return 0;
          return a.success ? -1 : 1;
        }
        // For others, sort by time (lower is better)
        const aTime = a.avgTime || a.totalTime || a.avgTimePerRequest || 0;
        const bTime = b.avgTime || b.totalTime || b.avgTimePerRequest || 0;
        return aTime - bTime;
      });

    if (testResults.length === 0) {
      log('   No results available', 'yellow');
      return;
    }

    testResults.forEach((result, index) => {
      const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      
      // Format output based on test type
      let output = `   ${rank} ${result.client.padEnd(15)}`;
      
      if (testType === 'Retry Mechanism') {
        const status = result.success ? 'PASSED' : 'FAILED';
        const timeStr = result.time ? `${result.time.toFixed(2)}ms` : '';
        output += ` ${status.padEnd(8)} ${timeStr}`;
      } else if (testType === 'Timeout Handling' || testType === 'Error Handling') {
        const rate = result.successRate !== undefined ? `${result.successRate.toFixed(1)}%` : 'N/A';
        output += ` ${rate.padStart(10)}`;
      } else {
        const time = result.avgTime || result.totalTime || result.avgTimePerRequest || 0;
        const timeStr = time > 0 ? `${time.toFixed(2)}ms` : 'N/A';
        const successStr = result.successRate !== undefined ? ` | Success: ${result.successRate.toFixed(1)}%` : '';
        output += ` ${timeStr.padStart(10)}${successStr}`;
      }
      
      log(output, 'reset');
    });
  });

  // Overall ranking
  log('\n\n🏆 OVERALL PERFORMANCE RANKING', 'bright');
  log('-'.repeat(80), 'reset');
  
  const clientScores = {};
  RESULTS.forEach(result => {
    if (!clientScores[result.client]) {
      clientScores[result.client] = { total: 0, count: 0 };
    }
    result.tests.forEach(test => {
      if (!test.skipped && (test.avgTime || test.totalTime || test.avgTimePerRequest)) {
        const time = test.avgTime || test.totalTime || test.avgTimePerRequest;
        clientScores[result.client].total += time;
        clientScores[result.client].count += 1;
      }
    });
  });

  const rankings = Object.entries(clientScores)
    .map(([client, score]) => ({
      client,
      avgScore: score.count > 0 ? score.total / score.count : Infinity,
    }))
    .sort((a, b) => a.avgScore - b.avgScore);

  rankings.forEach((rank, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    log(`   ${medal} ${rank.client.padEnd(15)} ${rank.avgScore.toFixed(2)}ms avg`, 'reset');
  });

  log('\n' + '='.repeat(80) + '\n', 'bright');
}

// Main function
async function main() {
  log('\n🚀 Starting HTTP Client Benchmark Suite', 'bright');
  log('='.repeat(80) + '\n', 'bright');

  let server;
  try {
    // Check if server is already running
    if (await checkServer()) {
      log('Test server already running', 'green');
    } else {
      server = await startServer();
    }

    // Initialize clients (load optional dependencies like got)
    await initializeClients();
    
    // Get list of clients
    const clientNames = Object.keys(clients);
    log(`\nTesting ${clientNames.length} HTTP clients: ${clientNames.join(', ')}\n`, 'cyan');

    // Run benchmarks for each client
    for (const clientName of clientNames) {
      await runBenchmarksForClient(clientName);
      // Small delay between clients
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Generate report
    generateReport();

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  } finally {
    if (server) {
      log('\nStopping test server...', 'cyan');
      server.kill();
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };

