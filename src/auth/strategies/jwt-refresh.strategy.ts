import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, UserStatus } from '../../users/entities/user.entity';

// Định nghĩa cấu trúc của Payload trong JWT để tránh lỗi 'any'
interface JwtPayload {
  id: number;
  email: string;
  role: string;
  candidateId?: number;
  jti?: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request): string | null => {
          const role = request.headers['x-user-role'] as string | undefined;

          // 1. Nếu có header X-User-Role, ưu tiên đọc đúng cookie đó
          if (role === 'admin')
            return (request.cookies?.admin_refresh_token as string) || null;
          if (role === 'employer')
            return (request.cookies?.employer_refresh_token as string) || null;
          if (role === 'candidate')
            return (request.cookies?.candidate_refresh_token as string) || null;

          // 2. Fallback: Nếu không có header (ví dụ Mobile/Flutter), quét tất cả các loại cookie
          const token = (request.cookies?.refresh_token ||
            request.cookies?.candidate_refresh_token ||
            request.cookies?.employer_refresh_token ||
            request.cookies?.admin_refresh_token) as string | undefined;

          return token || null;
        },
      ]),
      secretOrKey:
        configService.get<string>('JWT_REFRESH_SECRET') || 'default_secret',
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const user = await this.userRepository.findOne({
      where: { id: payload.id },
    });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    if (user.status === UserStatus.LOCKED) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
    }

    const role = payload.role;
    let cookieName = 'refresh_token';
    if (role === 'admin') cookieName = 'admin_refresh_token';
    else if (role === 'employer') cookieName = 'employer_refresh_token';
    else if (role === 'candidate') cookieName = 'candidate_refresh_token';

    const refreshToken = (req.cookies?.[cookieName] ||
      req.cookies?.refresh_token) as string | undefined;

    return {
      ...payload,
      refreshToken,
    };
  }
}
