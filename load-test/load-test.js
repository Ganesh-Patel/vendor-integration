import autocannon from 'autocannon';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting Load Test for Vendor Integration Service');
console.log('============================================================');

// Test configuration
const config = {
  url: 'http://localhost:3000',
  connections: 10,
  duration: 30,
  pipelining: 1,
  timeout: 10
};

// Test scenarios
const scenarios = [
  {
    name: 'Job Creation Load Test',
    url: `${config.url}/api/jobs`,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      payload: { 
        userId: Math.floor(Math.random() * 10000), 
        data: { query: 'load test query' } 
      }
    })
  },
  {
    name: 'Health Check Load Test',
    url: `${config.url}/health`,
    method: 'GET'
  },
  {
    name: 'Job Status Check Load Test',
    url: `${config.url}/api/jobs/550e8400-e29b-41d4-a716-446655440000/status`,
    method: 'GET'
  }
];

async function runLoadTest(scenario) {
  console.log(`\n📊 Running: ${scenario.name}`);
  console.log('------------------------------------------------------------');

  return new Promise((resolve) => {
    const test = autocannon({
      ...config,
      ...scenario,
      setupClient: (client) => {
        // Add random user ID for job creation
        if (scenario.method === 'POST') {
          client.setBody(JSON.stringify({
            payload: { 
              userId: Math.floor(Math.random() * 10000), 
              data: { query: 'load test query' } 
            }
          }));
        }
      }
    });

    autocannon.track(test, { renderProgressBar: true });

    test.on('done', (results) => {
      console.log('\n📈 Results:');
      console.log(`   - Requests: ${results.requests.total}`);
      console.log(`   - Throughput: ${results.throughput.total} req/sec`);
      console.log(`   - Average Latency: ${results.latency.average} ms`);
      console.log(`   - 95th Percentile: ${results.latency.p95} ms`);
      console.log(`   - 99th Percentile: ${results.latency.p99} ms`);
      console.log(`   - Errors: ${results.errors}`);
      console.log(`   - Timeouts: ${results.timeouts}`);
      console.log(`   - Duration: ${results.duration} seconds`);
      
      resolve(results);
    });
  });
}

async function runAllTests() {
  console.log('Starting comprehensive load test suite...\n');
  
  const results = {};
  
  for (const scenario of scenarios) {
    try {
      results[scenario.name] = await runLoadTest(scenario);
    } catch (error) {
      console.error(`❌ Error running ${scenario.name}:`, error.message);
    }
  }

  // Generate summary
  console.log('\n============================================================');
  console.log('📊 LOAD TEST SUMMARY');
  console.log('============================================================');
  
  Object.entries(results).forEach(([name, result]) => {
    console.log(`\n${name}:`);
    console.log(`   - Throughput: ${result.throughput.total} req/sec`);
    console.log(`   - Avg Latency: ${result.latency.average} ms`);
    console.log(`   - Error Rate: ${((result.errors / result.requests.total) * 100).toFixed(2)}%`);
  });

  // Overall analysis
  const totalRequests = Object.values(results).reduce((sum, r) => sum + r.requests.total, 0);
  const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors, 0);
  const avgThroughput = Object.values(results).reduce((sum, r) => sum + r.throughput.total, 0) / Object.keys(results).length;
  const avgLatency = Object.values(results).reduce((sum, r) => sum + r.latency.average, 0) / Object.keys(results).length;

  console.log('\n🎯 OVERALL PERFORMANCE:');
  console.log(`   - Total Requests: ${totalRequests}`);
  console.log(`   - Average Throughput: ${avgThroughput.toFixed(2)} req/sec`);
  console.log(`   - Average Latency: ${avgLatency.toFixed(2)} ms`);
  console.log(`   - Overall Error Rate: ${((totalErrors / totalRequests) * 100).toFixed(2)}%`);

  // Performance assessment
  console.log('\n📋 PERFORMANCE ASSESSMENT:');
  if (avgLatency < 100) {
    console.log('   ✅ Latency: Excellent (< 100ms)');
  } else if (avgLatency < 500) {
    console.log('   ⚠️  Latency: Good (< 500ms)');
  } else {
    console.log('   ❌ Latency: Needs improvement (> 500ms)');
  }

  if (avgThroughput > 100) {
    console.log('   ✅ Throughput: Excellent (> 100 req/sec)');
  } else if (avgThroughput > 50) {
    console.log('   ⚠️  Throughput: Good (> 50 req/sec)');
  } else {
    console.log('   ❌ Throughput: Needs improvement (< 50 req/sec)');
  }

  if ((totalErrors / totalRequests) < 0.01) {
    console.log('   ✅ Error Rate: Excellent (< 1%)');
  } else if ((totalErrors / totalRequests) < 0.05) {
    console.log('   ⚠️  Error Rate: Good (< 5%)');
  } else {
    console.log('   ❌ Error Rate: Needs improvement (> 5%)');
  }

  console.log('\n============================================================');
  console.log('Load test completed! 🎉');
}

// Run the load test
runAllTests().catch(console.error); 