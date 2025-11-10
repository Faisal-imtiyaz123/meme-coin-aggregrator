

// setting the test env here
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';

// setting the timeout here
jest.setTimeout(30000);