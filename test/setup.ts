/**
 * Test environment setup
 * This file is loaded before all tests to ensure proper configuration
 */

// Set test environment variables to prevent initialization errors
process.env.NODE_ENV = 'test';
process.env.AHA_COMPANY = 'test-company';
process.env.AHA_TOKEN = 'test-token';

// Disable telemetry console output during tests
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = '';

console.log('Test environment configured');
console.log(`AHA_COMPANY: ${process.env.AHA_COMPANY}`);
console.log(`AHA_TOKEN: ${process.env.AHA_TOKEN ? 'configured' : 'not configured'}`);