import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, UserRole } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { RegisterEmployerDto } from './dto/register-employer.dto';
import { CandidateEntity } from '../candidates/entities/candidate.entity';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidateRepository: Repository<CandidateEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, phone, provinceId } =
      registerDto;

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
    }

    // Tạo user mới - role mặc định là candidate
    const user = this.userRepository.create({
      email,
      password,
      role: UserRole.CANDIDATE,
    });
    const savedUser = await this.userRepository.save(user);

    const candidate = this.candidateRepository.create({
      userId: savedUser.id,
      fullName: `${lastName} ${firstName}`,
      phone,
      provinceId,
    });
    await this.candidateRepository.save(candidate);

    return {
      message: 'User registered successfully',
      user: {
        id: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
        fullName: candidate.fullName,
        phone: candidate.phone,
        provinceId: candidate.provinceId,
      },
    };
  }

  async registerEmployer(dto: RegisterEmployerDto) {
    const { email, password } = dto;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const user = this.userRepository.create({
      email,
      password,
      role: UserRole.EMPLOYER,
    });
    const savedUser = await this.userRepository.save(user);

    return {
      message: 'Tài khoản Employer được tạo thành công',
      user: {
        id: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
      },
    };
  }

  async validateUser({ email, password }: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['candidate'],
    });
    if (!user) {
      return null;
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }
    return user;
  }

  async generateTokenPair(user: UserEntity) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      ...(user.candidate ? { candidateId: user.candidate.id } : {}),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_TIME') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_TIME',
        ) as any,
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async storeRefreshToken(
    userId: number,
    token: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const hashedToken = await bcrypt.hash(token, 10);
    const expiresAt = new Date();
    // Giả sử refresh token hết hạn sau 7 ngày (đồng bộ với JWT config)
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = this.refreshTokenRepository.create({
      userId,
      token: hashedToken,
      expiresAt,
      userAgent,
      ipAddress,
    });

    await this.refreshTokenRepository.save(refreshToken);
  }

  async refreshTokens(userId: number, rawRefreshToken: string, userAgent?: string, ipAddress?: string) {
    const user = await this.userRepository.findOne({ 
      where: { id: userId },
      relations: ['candidate']
    });
    if (!user) throw new ConflictException('User not found');

    // Tìm xem token này có trong DB không
    const savedTokens = await this.refreshTokenRepository.find({
      where: { userId, isRevoked: false },
    });

    // So khớp token đã hash
    let matchedTokenRecord = null;
    for (const record of savedTokens) {
      const isMatch = await bcrypt.compare(rawRefreshToken, record.token);
      if (isMatch) {
        matchedTokenRecord = record;
        break;
      }
    }

    if (!matchedTokenRecord) {
      throw new ConflictException('Invalid Refresh Token');
    }

    // Xoay vòng (Rotation): Xóa bản ghi cũ
    await this.refreshTokenRepository.remove(matchedTokenRecord);

    // Tạo cặp mới
    const tokens = await this.generateTokenPair(user);
    await this.storeRefreshToken(user.id, tokens.refresh_token, userAgent, ipAddress);

    return tokens;
  }

  async logout(userId: number, rawRefreshToken: string) {
    const savedTokens = await this.refreshTokenRepository.find({
      where: { userId, isRevoked: false },
    });

    for (const record of savedTokens) {
      const isMatch = await bcrypt.compare(rawRefreshToken, record.token);
      if (isMatch) {
        await this.refreshTokenRepository.remove(record);
        break;
      }
    }
  }

  setRefreshTokenCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });
  }

  clearRefreshTokenCookie(res: Response) {
    res.clearCookie('refresh_token');
  }

  async login(user: UserEntity) {
    const tokens = await this.generateTokenPair(user);
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async loginAdmin(dto: LoginDto) {
    // 1. Tìm user theo email
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    // 2. Chặn sớm nếu không phải Admin hoặc không tồn tại (Security Requirement)
    if (!user || user.role !== UserRole.ADMIN) {
      throw new ConflictException('Tài khoản không có quyền quản trị');
    }

    // 3. So khớp password (chỉ dành cho Admin)
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new ConflictException('Mật khẩu không chính xác');
    }

    // 4. Trả về Token Admin
    return this.login(user);
  }
}
