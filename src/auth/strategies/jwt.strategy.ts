import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  // Passport decode token xong → truyền payload vào đây
  // Giá trị return sẽ được gắn vào req.user
  validate(payload: {
    id: number;
    email: string;
    role: string;
    candidateId?: number;
  }) {
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      candidateId: payload.candidateId,
    };
  }
}
