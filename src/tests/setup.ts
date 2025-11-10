// tests/setup.ts
import { config } from '../src/config';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Global test timeout
jest.setTimeout(30000);

// Global beforeAll
beforeAll(async () => {
  // Setup code if needed
});

// Global afterAll
afterAll(async () => {
  // Cleanup code if needed
});