import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Running Fixed Test Suite');
console.log('============================================================');

const testFiles = [
  'tests/simple.test.js',
  'tests/simple-unit.test.js',
  'tests/simple-integration.test.js',
  'tests/simple-load-balancing.test.js'
];

const results = {
  simple: { passed: 0, failed: 0, total: 0 },
  unit: { passed: 0, failed: 0, total: 0 },
  integration: { passed: 0, failed: 0, total: 0 },
  loadBalancing: { passed: 0, failed: 0, total: 0 }
};

async function runTest(testFile) {
  return new Promise((resolve) => {
    const testName = testFile.split('/').pop().replace('.test.js', '');
    console.log(`\n🚀 Running ${testName} tests: ${testFile}`);
    console.log('============================================================');

    const child = spawn('node', [testFile], {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      const success = code === 0;
      const resultKey = testName === 'simple' ? 'simple' : 
                       testName === 'simple-unit' ? 'unit' : 
                       testName === 'simple-integration' ? 'integration' : 
                       testName === 'simple-load-balancing' ? 'loadBalancing' : 'unknown';
      
      if (success) {
        results[resultKey].passed = 1;
        results[resultKey].failed = 0;
        results[resultKey].total = 1;
        console.log(`\n✅ ${testName} tests passed`);
      } else {
        results[resultKey].passed = 0;
        results[resultKey].failed = 1;
        results[resultKey].total = 1;
        console.log(`\n❌ ${testName} tests failed with code ${code}`);
      }
      
      resolve();
    });
  });
}

async function runAllTests() {
  for (const testFile of testFiles) {
    try {
      await runTest(testFile);
    } catch (error) {
      console.error(`Error running ${testFile}:`, error);
    }
  }

  // Generate summary
  console.log('\n============================================================');
  console.log('📊 TEST EXECUTION SUMMARY');
  console.log('============================================================');
  
  const totalTests = Object.values(results).reduce((sum, r) => sum + r.total, 0);
  const totalPassed = Object.values(results).reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = Object.values(results).reduce((sum, r) => sum + r.failed, 0);
  
  Object.entries(results).forEach(([name, result]) => {
    const status = result.failed === 0 ? '✅ PASSED' : '❌ FAILED';
    console.log(`${name.toUpperCase()} TESTS: ${status}`);
    console.log(`  - Passed: ${result.passed}`);
    console.log(`  - Failed: ${result.failed}`);
    console.log(`  - Total: ${result.total}`);
  });

  console.log('\nOVERALL RESULTS:');
  console.log(`  - Total Tests: ${totalTests}`);
  console.log(`  - Passed: ${totalPassed}`);
  console.log(`  - Failed: ${totalFailed}`);
  console.log(`  - Success Rate: ${totalTests > 0 ? (totalPassed / totalTests * 100).toFixed(2) : 0}%`);

  if (totalFailed > 0) {
    console.log('\n⚠️  SOME TESTS FAILED');
    console.log('============================================================');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('============================================================');
  }
}

runAllTests().catch(console.error); 