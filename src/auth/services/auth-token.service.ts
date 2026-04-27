import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { UserEntity } from '../../users/entities/user.entity';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';
import { AUTH_CONFIG } from '../../common/constants/auth.constant';

@Injectable()
export class AuthTokenService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateTokenPair(user: UserEntity, jti?: string) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      ...(user.candidate ? { candidateId: user.candidate.id } : {}),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_EXPIRES_TIME',
        ) as import('@nestjs/jwt').JwtSignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(
        { ...payload, jti },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>(
            'JWT_REFRESH_EXPIRES_TIME',
          ) as import('@nestjs/jwt').JwtSignOptions['expiresIn'],
        },
      ),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async storeRefreshToken(
    userId: number,
    token: string,
    jti: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const hashedToken = await bcrypt.hash(token, AUTH_CONFIG.SALT_ROUNDS);
    const expiresAt = new Date();
    const refreshExpiresConfig = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_TIME',
      AUTH_CONFIG.REFRESH_TOKEN_DEFAULT_EXPIRY_DAYS.toString() + 'd',
    );
    const daysMatch = refreshExpiresConfig.match(/^(\d+)d$/);
    const expiryDays = daysMatch
      ? parseInt(daysMatch[1], 10)
      : AUTH_CONFIG.REFRESH_TOKEN_DEFAULT_EXPIRY_DAYS;
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const refreshToken = this.refreshTokenRepository.create({
      id: jti,
      userId,
      token: hashedToken,
      expiresAt,
      userAgent,
      ipAddress,
    });

    await this.refreshTokenRepository.save(refreshToken);
  }

  async refreshTokens(
    userId: number,
    jti: string,
    rawRefreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['candidate'],
    });
    if (!user) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');

    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { id: jti, userId, isRevoked: false },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const isMatch = await bcrypt.compare(rawRefreshToken, tokenRecord.token);
    if (!isMatch) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    await this.refreshTokenRepository.remove(tokenRecord);

    const newJti = crypto.randomUUID();
    const tokens = await this.generateTokenPair(user, newJti);
    await this.storeRefreshToken(
      user.id,
      tokens.refresh_token,
      newJti,
      userAgent,
      ipAddress,
    );

    return tokens;
  }

  async logout(userId: number, jti?: string) {
    if (!jti) return;
    await this.refreshTokenRepository.delete({ id: jti, userId });
  }

  async logoutAllDevices(userId: number) {
    await this.refreshTokenRepository.delete({ userId });
    return { message: 'Đã đăng xuất khỏi tất cả thiết bị.' };
  }

  setRefreshTokenCookie(res: Response, token: string) {
    res.cookie(AUTH_CONFIG.COOKIE.REFRESH_TOKEN, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: AUTH_CONFIG.COOKIE.MAX_AGE_MS,
    });
  }

  clearRefreshTokenCookie(res: Response) {
    res.clearCookie(AUTH_CONFIG.COOKIE.REFRESH_TOKEN);
  }
}
