#!/usr/bin/env node
// Simple Load Testing Script for Syntra VMS
// ========================================
// This script simulates multiple users accessing the application

const axios = require('axios');

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS) || 10;
const REQUESTS_PER_USER = parseInt(process.env.REQUESTS_PER_USER) || 50;
const REQUEST_DELAY = parseInt(process.env.REQUEST_DELAY) || 100; // milliseconds

// Test scenarios
const scenarios = [
  // Dashboard access
  { 
    name: 'Dashboard Load',
    method: 'GET',
    path: '/api/dashboard/summary',
    weight: 0.3
  },
  
  // Transport requests listing
  { 
    name: 'Transport Requests',
    method: 'GET',
    path: '/api/transport',
    weight: 0.2
  },
  
  // User notifications
  { 
    name: 'User Notifications',
    method: 'GET',
    path: '/api/notifications',
    weight: 0.2
  },
  
  // Sidebar counts
  { 
    name: 'Sidebar Counts',
    method: 'GET',
    path: '/api/sidebar-counts',
    weight: 0.15
  },
  
  // User details
  { 
    name: 'User Details',
    method: 'GET',
    path: '/api/user-details',
    weight: 0.15
  }
];

// Statistics tracking
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalResponseTime: 0,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  responseTimesByEndpoint: {},
  errorsByEndpoint: {},
  statusCodes: {},
  startTime: null,
  endTime: null
};

// Simulate a single user session
async function simulateUser(userId) {
  console.log(`🔄 Starting user ${userId} simulation...`);
  
  for (let i = 0; i < REQUESTS_PER_USER; i++) {
    try {
      // Select a random scenario based on weights
      const scenario = selectScenario();
      const startTime = Date.now();
      
      const response = await axios({
        method: scenario.method,
        url: `${BASE_URL}${scenario.path}`,
        timeout: 10000,
        headers: {
          'User-Agent': `LoadTest-User-${userId}`,
          'Accept': 'application/json'
        }
      });
      
      const responseTime = Date.now() - startTime;
      updateStats(scenario.name, response.status, responseTime, null);
      
      if (i % 10 === 0) {
        console.log(`  👤 User ${userId}: ${i}/${REQUESTS_PER_USER} requests completed`);
      }
      
      // Delay between requests
      await sleep(REQUEST_DELAY);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      updateStats(scenario.name, error.response?.status || 0, responseTime, error.message);
      
      console.log(`  ❌ User ${userId}: Error - ${error.message}`);
    }
  }
  
  console.log(`✅ User ${userId} completed ${REQUESTS_PER_USER} requests`);
}

// Select scenario based on weights
function selectScenario() {
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (const scenario of scenarios) {
    cumulativeWeight += scenario.weight;
    if (random <= cumulativeWeight) {
      return scenario;
    }
  }
  
  return scenarios[scenarios.length - 1];
}

// Update statistics
function updateStats(endpoint, statusCode, responseTime, error) {
  stats.totalRequests++;
  
  if (statusCode >= 200 && statusCode < 400) {
    stats.successfulRequests++;
  } else {
    stats.failedRequests++;
  }
  
  stats.totalResponseTime += responseTime;
  stats.minResponseTime = Math.min(stats.minResponseTime, responseTime);
  stats.maxResponseTime = Math.max(stats.maxResponseTime, responseTime);
  
  // Track by endpoint
  if (!stats.responseTimesByEndpoint[endpoint]) {
    stats.responseTimesByEndpoint[endpoint] = [];
  }
  stats.responseTimesByEndpoint[endpoint].push(responseTime);
  
  // Track errors by endpoint
  if (error) {
    if (!stats.errorsByEndpoint[endpoint]) {
      stats.errorsByEndpoint[endpoint] = 0;
    }
    stats.errorsByEndpoint[endpoint]++;
  }
  
  // Track status codes
  if (!stats.statusCodes[statusCode]) {
    stats.statusCodes[statusCode] = 0;
  }
  stats.statusCodes[statusCode]++;
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate percentile
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = arr.sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index];
}

// Print results
function printResults() {
  const duration = stats.endTime - stats.startTime;
  const avgResponseTime = stats.totalResponseTime / stats.totalRequests;
  const requestsPerSecond = (stats.totalRequests / duration) * 1000;
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 LOAD TEST RESULTS');
  console.log('='.repeat(60));
  
  console.log(`\n📊 Overall Statistics:`);
  console.log(`   Duration: ${(duration / 1000).toFixed(2)} seconds`);
  console.log(`   Concurrent Users: ${CONCURRENT_USERS}`);
  console.log(`   Requests per User: ${REQUESTS_PER_USER}`);
  console.log(`   Total Requests: ${stats.totalRequests}`);
  console.log(`   Successful Requests: ${stats.successfulRequests} (${((stats.successfulRequests/stats.totalRequests)*100).toFixed(1)}%)`);
  console.log(`   Failed Requests: ${stats.failedRequests} (${((stats.failedRequests/stats.totalRequests)*100).toFixed(1)}%)`);
  console.log(`   Requests/Second: ${requestsPerSecond.toFixed(2)}`);
  
  console.log(`\n⏱️ Response Time Statistics:`);
  console.log(`   Average: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`   Minimum: ${stats.minResponseTime}ms`);
  console.log(`   Maximum: ${stats.maxResponseTime}ms`);
  
  console.log(`\n📈 Response Time by Endpoint:`);
  for (const [endpoint, times] of Object.entries(stats.responseTimesByEndpoint)) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const p95 = percentile(times, 95);
    const p99 = percentile(times, 99);
    
    console.log(`   ${endpoint}:`);
    console.log(`     Average: ${avg.toFixed(2)}ms`);
    console.log(`     95th percentile: ${p95}ms`);
    console.log(`     99th percentile: ${p99}ms`);
    console.log(`     Requests: ${times.length}`);
  }
  
  console.log(`\n🚦 HTTP Status Codes:`);
  for (const [code, count] of Object.entries(stats.statusCodes)) {
    console.log(`   ${code}: ${count} requests (${((count/stats.totalRequests)*100).toFixed(1)}%)`);
  }
  
  if (Object.keys(stats.errorsByEndpoint).length > 0) {
    console.log(`\n❌ Errors by Endpoint:`);
    for (const [endpoint, count] of Object.entries(stats.errorsByEndpoint)) {
      console.log(`   ${endpoint}: ${count} errors`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Performance assessment
  if (avgResponseTime < 500 && requestsPerSecond > 50) {
    console.log('🟢 Performance: EXCELLENT - App handles load very well');
  } else if (avgResponseTime < 1000 && requestsPerSecond > 20) {
    console.log('🟡 Performance: GOOD - App handles load adequately'); 
  } else if (avgResponseTime < 2000 && requestsPerSecond > 10) {
    console.log('🟠 Performance: FAIR - Consider optimization');
  } else {
    console.log('🔴 Performance: POOR - Optimization required');
  }
  
  console.log('='.repeat(60));
}

// Main execution
async function runLoadTest() {
  console.log('🚀 Starting Load Test for Syntra VMS');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Concurrent Users: ${CONCURRENT_USERS}`);
  console.log(`Requests per User: ${REQUESTS_PER_USER}`);
  console.log(`Total Expected Requests: ${CONCURRENT_USERS * REQUESTS_PER_USER}`);
  console.log('');
  
  stats.startTime = Date.now();
  
  // Create promises for all users
  const userPromises = [];
  for (let i = 1; i <= CONCURRENT_USERS; i++) {
    userPromises.push(simulateUser(i));
  }
  
  // Wait for all users to complete
  await Promise.all(userPromises);
  
  stats.endTime = Date.now();
  
  // Print results
  printResults();
}

// Handle script execution
if (require.main === module) {
  runLoadTest().catch(error => {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  });
}

module.exports = { runLoadTest };