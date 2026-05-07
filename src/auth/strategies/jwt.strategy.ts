import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';
import { UserStatus } from '../../users/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  // Passport decode token xong → truyền payload vào đây
  // Giá trị return sẽ được gắn vào req.user
  async validate(payload: {
    id: number;
    email: string;
    role: string;
    candidateId?: number;
    jti?: string;
  }) {
    if (!payload.jti) {
      throw new UnauthorizedException(
        'Phiên đăng nhập không hợp lệ hoặc đã cũ',
      );
    }

    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { id: payload.jti, isRevoked: false },
      relations: ['user'],
    });

    if (!tokenRecord) {
      throw new UnauthorizedException(
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
      );
    }

    if (tokenRecord.user.status === UserStatus.LOCKED) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
    }

    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      candidateId: payload.candidateId,
    };
  }
}
