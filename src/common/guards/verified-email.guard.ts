import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { Repository } from 'typeorm';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { id: number; email: string; role: string };
}

/**
 * Guard kiểm tra user đã xác thực email trước khi sử dụng các tính năng nhạy cảm.
 * Áp dụng cho: Nộp đơn ứng tuyển, Upload CV, Đăng tin tuyển dụng, v.v.
 *
 * Phải dùng SAU JwtAuthGuard (vì cần req.user).
 */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = req.user?.id;

    if (!userId) {
      throw new ForbiddenException('Người dùng chưa xác thực');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'isEmailVerified'],
    });

    if (!user?.isEmailVerified) {
      throw new ForbiddenException(
        'Vui lòng xác thực email trước khi sử dụng tính năng này. Kiểm tra hộp thư hoặc yêu cầu gửi lại tại POST /auth/resend-verification.',
      );
    }

    return true;
  }
}
