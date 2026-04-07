import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

// Định nghĩa cấu trúc của Payload trong JWT để tránh lỗi 'any'
interface JwtPayload {
  id: number;
  email: string;
  role: string;
  candidateId?: number;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request): string | null => {
          const token = request?.cookies?.refresh_token as string | undefined;
          return token || null;
        },
      ]),
      secretOrKey:
        configService.get<string>('JWT_REFRESH_SECRET') || 'default_secret',
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload) {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    return {
      ...payload,
      refreshToken,
    };
  }
}
