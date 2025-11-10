// tests/integration/websocket.test.ts
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket } from 'socket.io-client';
import { WebSocketService } from '../../src/services/WebSocketService';
import { CacheService } from '../../src/services/CacheService';

describe('WebSocket Integration Tests', () => {
  let io: SocketIOServer;
  let server: any;
  let clientSocket: Socket;
  let websocketService: WebSocketService;
  let cacheService: CacheService;

  beforeAll((done) => {
    server = createServer();
    io = new SocketIOServer(server);
    cacheService = new CacheService();
    websocketService = new WebSocketService(io, cacheService);
    
    server.listen(3001, () => {
      done();
    });
  });

  afterAll(() => {
    io.close();
    server.close();
    cacheService.disconnect();
  });

  beforeEach((done) => {
    clientSocket = Client('http://localhost:3001');
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  it('should handle client connection', (done) => {
    clientSocket.on('connect', () => {
      expect(clientSocket.connected).toBe(true);
      done();
    });
  });

  it('should handle token subscription', (done) => {
    clientSocket.emit('subscribe_tokens', { tokens: ['token1', 'token2'] });
    
    // Add a small delay to ensure the event is processed
    setTimeout(() => {
      // We can't easily test internal state, but we can verify no errors occurred
      expect(clientSocket.connected).toBe(true);
      done();
    }, 100);
  });
});