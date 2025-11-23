// Main benchmark entry point
import { main } from './runner.js';

main().catch(error => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});

