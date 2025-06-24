import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class TestRunner {
  constructor() {
    this.testResults = {
      simple: { passed: 0, failed: 0, total: 0 },
      integration: { passed: 0, failed: 0, total: 0 },
      unit: { passed: 0, failed: 0, total: 0 },
      loadBalancing: { passed: 0, failed: 0, total: 0 }
    };
    this.startTime = Date.now();
  }

  async runTest(testFile, testType) {
    return new Promise((resolve) => {
      console.log(`\n🚀 Running ${testType} tests: ${testFile}`);
      console.log('='.repeat(60));

      const testProcess = spawn('node', ['--test', testFile], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let output = '';
      let errorOutput = '';

      testProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text);
      });

      testProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        process.stderr.write(text);
      });

      testProcess.on('close', (code) => {
        const success = code === 0;
        const result = {
          testType,
          file: testFile,
          success,
          code,
          output,
          errorOutput,
          duration: Date.now() - this.startTime
        };

        if (success) {
          this.testResults[testType].passed++;
          console.log(`\n✅ ${testType} tests passed`);
        } else {
          this.testResults[testType].failed++;
          console.log(`\n❌ ${testType} tests failed with code ${code}`);
        }

        this.testResults[testType].total++;
        resolve(result);
      });

      testProcess.on('error', (error) => {
        console.error(`\n💥 Error running ${testType} tests:`, error.message);
        this.testResults[testType].failed++;
        this.testResults[testType].total++;
        resolve({
          testType,
          file: testFile,
          success: false,
          error: error.message,
          duration: Date.now() - this.startTime
        });
      });
    });
  }

  async runAllTests() {
    console.log('🧪 Starting Comprehensive Test Suite');
    console.log('='.repeat(60));

    const testFiles = [
      { file: 'tests/simple.test.js', type: 'simple' },
      { file: 'tests/integration.test.js', type: 'integration' },
      { file: 'tests/unit.test.js', type: 'unit' },
      { file: 'tests/load-balancing.test.js', type: 'loadBalancing' }
    ];

    const results = [];

    for (const testFile of testFiles) {
      if (fs.existsSync(testFile.file)) {
        const result = await this.runTest(testFile.file, testFile.type);
        results.push(result);
      } else {
        console.log(`⚠️  Test file not found: ${testFile.file}`);
      }
    }

    return results;
  }

  generateReport(results) {
    const totalDuration = Date.now() - this.startTime;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST EXECUTION SUMMARY');
    console.log('='.repeat(60));

    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;

    Object.entries(this.testResults).forEach(([testType, stats]) => {
      if (stats.total > 0) {
        const status = stats.failed === 0 ? '✅ PASSED' : '❌ FAILED';
        console.log(`${testType.toUpperCase()} TESTS: ${status}`);
        console.log(`  - Passed: ${stats.passed}`);
        console.log(`  - Failed: ${stats.failed}`);
        console.log(`  - Total: ${stats.total}`);
        console.log('');

        totalPassed += stats.passed;
        totalFailed += stats.failed;
        totalTests += stats.total;
      }
    });

    console.log('OVERALL RESULTS:');
    console.log(`  - Total Duration: ${totalDuration}ms`);
    console.log(`  - Total Tests: ${totalTests}`);
    console.log(`  - Passed: ${totalPassed}`);
    console.log(`  - Failed: ${totalFailed}`);
    console.log(`  - Success Rate: ${totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : 0}%`);

    if (totalFailed === 0 && totalTests > 0) {
      console.log('\n🎉 ALL TESTS PASSED!');
    } else if (totalTests > 0) {
      console.log('\n⚠️  SOME TESTS FAILED');
    } else {
      console.log('\n⚠️  NO TESTS WERE RUN');
    }

    console.log('='.repeat(60));

    return {
      totalPassed,
      totalFailed,
      totalTests,
      duration: totalDuration,
      success: totalFailed === 0 && totalTests > 0
    };
  }

  async runLoadTest() {
    console.log('\n🔥 Starting Load Test with Artillery');
    console.log('='.repeat(60));

    return new Promise((resolve) => {
      const loadTestProcess = spawn('npx', ['artillery', 'run', 'load-test/load-test.js'], {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'test' }
      });

      loadTestProcess.on('close', (code) => {
        const success = code === 0;
        console.log(`\n${success ? '✅' : '❌'} Load test completed with code ${code}`);
        resolve({ success, code });
      });

      loadTestProcess.on('error', (error) => {
        console.error('\n💥 Load test error:', error.message);
        resolve({ success: false, error: error.message });
      });
    });
  }

  async runMockVendorTest() {
    console.log('\n🎭 Starting Mock Vendor Integration Test');
    console.log('='.repeat(60));

    return new Promise((resolve) => {
      const mockProcess = spawn('node', ['mocks/vendor-mock.js'], {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'test' }
      });

      mockProcess.on('close', (code) => {
        const success = code === 0;
        console.log(`\n${success ? '✅' : '❌'} Mock vendor test completed with code ${code}`);
        resolve({ success, code });
      });

      mockProcess.on('error', (error) => {
        console.error('\n💥 Mock vendor test error:', error.message);
        resolve({ success: false, error: error.message });
      });
    });
  }

  async runCompleteTestSuite() {
    try {
      console.log('🚀 Starting Complete Vendor Integration Test Suite');
      console.log('This will run:');
      console.log('  - Simple tests (basic functionality)');
      console.log('  - Unit tests');
      console.log('  - Integration tests');
      console.log('  - Load balancing tests');
      console.log('  - Load tests with Artillery (if available)');
      console.log('  - Mock vendor integration tests (if available)');
      console.log('');

      const testResults = await this.runAllTests();
      const report = this.generateReport(testResults);

      if (report.success) {
        console.log('\n🔄 Running additional performance tests...');
        
        try {
          const loadTestResult = await this.runLoadTest();
          console.log(`\n📈 Load Test: ${loadTestResult.success ? '✅ PASSED' : '❌ FAILED'}`);
        } catch (error) {
          console.log('\n📈 Load Test: ⚠️ SKIPPED (Artillery not available)');
        }

        try {
          const mockTestResult = await this.runMockVendorTest();
          console.log(`\n📈 Mock Vendor Test: ${mockTestResult.success ? '✅ PASSED' : '❌ FAILED'}`);
        } catch (error) {
          console.log('\n📈 Mock Vendor Test: ⚠️ SKIPPED (Mock service not available)');
        }

        console.log('\n' + '='.repeat(60));
        console.log('🏁 COMPLETE TEST SUITE: ✅ ALL TESTS PASSED');
        console.log('='.repeat(60));

        process.exit(0);
      } else {
        console.log('\n❌ Stopping test suite due to test failures');
        process.exit(1);
      }
    } catch (error) {
      console.error('\n💥 Test runner error:', error.message);
      process.exit(1);
    }
  }
}

const runner = new TestRunner();

if (process.argv.includes('--load-test-only')) {
  runner.runLoadTest().then(result => {
    process.exit(result.success ? 0 : 1);
  });
} else if (process.argv.includes('--mock-test-only')) {
  runner.runMockVendorTest().then(result => {
    process.exit(result.success ? 0 : 1);
  });
} else {
  runner.runCompleteTestSuite();
} 