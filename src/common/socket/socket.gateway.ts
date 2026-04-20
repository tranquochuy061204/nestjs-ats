import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  id: number;
  email: string;
  role: string;
}

interface AuthenticatedSocket extends Socket {
  data: {
    user: JwtPayload;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*', // Trong môi trường production, nên giới hạn lại theo CORS_ORIGIN trong .env
  },
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway Initialized');
  }

  async handleConnection(client: Socket) {
    try {
      // 1. Xác thực JWT từ handshake auth hoặc cookie
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Client ${client.id} không cung cấp token xác thực`);
        client.disconnect();
        return;
      }

      const payload = (await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      })) as JwtPayload;

      // 2. Lưu thông tin user vào socket data
      client.data.user = payload;

      // 3. Tự động tham gia phòng cá nhân: user_{userId}
      const userId = payload.id;
      await client.join(`user_${userId}`);

      this.logger.log(
        `Client ${client.id} (User: ${userId}) đã kết nối và tham gia phòng cá nhân`,
      );
    } catch (error) {
      this.logger.error(
        `Xác thực kết nối thất bại cho client ${client.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.user?.id;
    this.logger.log(`Client ${client.id} (User: ${userId}) đã ngắt kết nối`);
  }

  // --- QUẢN LÝ PHÒNG (ROOM MANAGEMENT) ---

  @SubscribeMessage('subscribe_job_kanban')
  async handleJoinJobKanban(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { jobId: number },
  ) {
    const room = `job_kanban_${data.jobId}`;
    await client.join(room);
    this.logger.log(`User ${client.data.user?.id} đã tham gia phòng ${room}`);
    return { status: 'success', room };
  }

  @SubscribeMessage('unsubscribe_job_kanban')
  async handleLeaveJobKanban(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { jobId: number },
  ) {
    const room = `job_kanban_${data.jobId}`;
    await client.leave(room);
    this.logger.log(`User ${client.data.user?.id} đã rời phòng ${room}`);
    return { status: 'success', room };
  }

  @SubscribeMessage('subscribe_application_detail')
  async handleJoinApplicationDetail(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { applicationId: number },
  ) {
    const room = `application_detail_${data.applicationId}`;
    await client.join(room);
    this.logger.log(`User ${client.data.user?.id} đã tham gia phòng ${room}`);
    return { status: 'success', room };
  }

  // --- HÀM TRỢ GIÚP GỬI TIN (EMIT HELPERS) ---

  sendToUser(userId: number, event: string, data: any) {
    this.server.to(`user_${userId}`).emit(event, data);
  }

  sendToJobBoard(jobId: number, event: string, data: any) {
    this.server.to(`job_kanban_${jobId}`).emit(event, data);
  }

  sendToApplicationDetail(applicationId: number, event: string, data: any) {
    this.server.to(`application_detail_${applicationId}`).emit(event, data);
  }

  // --- HÀM TRỢ GIÚP NỘI BỘ ---

  private extractToken(client: Socket): string | null {
    // 1. Kiểm tra trong handshake auth
    const auth = client.handshake.auth as { token?: string };
    const tokenFromAuth = auth?.token;
    if (tokenFromAuth) return tokenFromAuth;

    // 2. Kiểm tra trong cookies (thường dùng cho web client)
    const cookies = client.handshake.headers.cookie;
    if (cookies) {
      const match = cookies.match(/access_token=([^;]+)/);
      if (match) return match[1];
    }

    return null;
  }
}
