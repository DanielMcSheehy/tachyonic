#!/usr/bin/env tsx
/**
 * Unified Benchmark Runner
 * 
 * Runs all benchmarks and displays their actual measured results.
 * Each benchmark reports its own real metrics.
 * 
 * Usage:
 *   npx tsx benchmarks/run-all.ts
 *   npm run benchmark
 */

import { spawn } from 'child_process';
import { performance } from 'perf_hooks';

async function runBenchmark(name: string, file: string): Promise<boolean> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${name}`);
  console.log('='.repeat(60));
  
  return new Promise((resolve) => {
    const proc = spawn('npx', ['tsx', file], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    
    proc.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     AI Edit SDK - Full Benchmarks                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\nRunning benchmarks - each will report its own measured results.\n');
  
  const benchmarks = [
    { name: 'Fast Apply Engine (vs String Replace)', file: 'benchmarks/fast-apply-benchmark.ts' },
    { name: 'Compact Engine (vs Truncation)', file: 'benchmarks/compact-benchmark.ts' },
    { name: 'Router Engine (vs LLM API Cost)', file: 'benchmarks/router-benchmark.ts' },
  ];
  
  const start = performance.now();
  const results: Array<{ name: string; success: boolean }> = [];
  
  for (const bench of benchmarks) {
    const success = await runBenchmark(bench.name, bench.file);
    results.push({ name: bench.name, success });
  }
  
  const totalTime = performance.now() - start;
  
  // Summary based on actual runs
  console.log('\n\n' + '='.repeat(60));
  console.log('BENCHMARK COMPLETE');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`\nResults: ${passed}/${total} benchmarks passed`);
  console.log(`Total time: ${(totalTime / 1000).toFixed(1)}s\n`);
  
  for (const r of results) {
    console.log(`  ${r.success ? '✅' : '❌'} ${r.name}`);
  }
  
  console.log(`
Note: Each benchmark above reports its own measured metrics:
  - Fast Apply: ops/sec, accuracy %, conflict rate
  - Compact: lines/ms, compression ratio, info retention %
  - Router: latency ms, classifications/sec, cost comparison

All numbers are measured on this machine, not hardcoded estimates.
`);
}

main().catch(console.error);
