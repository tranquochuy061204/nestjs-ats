import { Test, TestingModule } from '@nestjs/testing';
import { SocketGateway } from './socket.gateway';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket, Server } from 'socket.io';

describe('SocketGateway', () => {
  let gateway: SocketGateway;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret'),
  };

  const mockSocket = {
    id: 'test-id',
    handshake: {
      auth: { token: 'test-token' },
      headers: { cookie: '' },
    },
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    data: {},
  } as unknown as Socket;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  } as unknown as Server;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocketGateway,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    gateway = module.get<SocketGateway>(SocketGateway);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    gateway.server = mockServer;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should authenticate and join user room on successful connection', async () => {
      const payload = { id: 1, email: 'test@example.com', role: 'candidate' };
      mockJwtService.verifyAsync.mockResolvedValue(payload);

      await gateway.handleConnection(mockSocket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('test-token', {
        secret: 'test-secret',
      });
      expect(mockSocket.join).toHaveBeenCalledWith('user_1');
      expect(mockSocket.data).toEqual({ user: payload });
    });

    it('should disconnect if no token is provided', async () => {
      const socketNoToken = {
        ...mockSocket,
        handshake: { auth: {}, headers: {} },
      } as unknown as Socket;

      await gateway.handleConnection(socketNoToken);

      expect(socketNoToken.disconnect).toHaveBeenCalled();
    });

    it('should disconnect if token verification fails', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('Room Management', () => {
    it('should allow joining job kanban room', async () => {
      const customSocket = { ...mockSocket, data: { user: { id: 1 } } } as any;
      const result = await gateway.handleJoinJobKanban(customSocket, { jobId: 123 });

      expect(customSocket.join).toHaveBeenCalledWith('job_kanban_123');
      expect(result).toEqual({ status: 'success', room: 'job_kanban_123' });
    });

    it('should allow joining application detail room', async () => {
      const customSocket = { ...mockSocket, data: { user: { id: 1 } } } as any;
      const result = await gateway.handleJoinApplicationDetail(customSocket, { applicationId: 456 });

      expect(customSocket.join).toHaveBeenCalledWith('application_detail_456');
      expect(result).toEqual({ status: 'success', room: 'application_detail_456' });
    });
  });

  describe('Emit Helpers', () => {
    it('should emit to specific user', () => {
      gateway.sendToUser(1, 'test_event', { data: 'hello' });
      expect(mockServer.to).toHaveBeenCalledWith('user_1');
      expect(mockServer.emit).toHaveBeenCalledWith('test_event', { data: 'hello' });
    });

    it('should emit to job board', () => {
      gateway.sendToJobBoard(123, 'kanban_update', { data: 'update' });
      expect(mockServer.to).toHaveBeenCalledWith('job_kanban_123');
      expect(mockServer.emit).toHaveBeenCalledWith('kanban_update', { data: 'update' });
    });
  });
});
