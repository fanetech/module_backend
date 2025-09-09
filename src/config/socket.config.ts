import { Server, ServerOptions } from 'socket.io';
import { Server as HttpServer } from 'http';

export const getSocketConfig = (): Partial<ServerOptions> => ({
  cors: {
    origin: process.env.WS_CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB
  transports: ['websocket', 'polling'] as any
});

export const createSocketServer = (httpServer: HttpServer): Server => {
  const config = getSocketConfig();
  return new Server(httpServer, config);
};
