import {
  Injectable,
  ConflictException,
  Inject,
  forwardRef,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, UserRole } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { RegisterEmployerDto } from './dto/register-employer.dto';
import { CandidateProfileService } from '../candidates/services/candidate-profile.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { Response } from 'express';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @Inject(forwardRef(() => CandidateProfileService))
    private readonly candidateProfileService: CandidateProfileService,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
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

    // Tạo token xác thực email (random hex 32 bytes = 64 chars)
    const verificationToken = this.generateVerificationToken();

    // Tạo user mới - role mặc định là candidate
    const user = this.userRepository.create({
      email,
      password,
      role: UserRole.CANDIDATE,
      emailVerificationToken: verificationToken,
      isEmailVerified: false,
    });
    const savedUser = await this.userRepository.save(user);

    const candidate = await this.candidateProfileService.createCoreProfile({
      userId: savedUser.id,
      firstName,
      lastName,
      phone,
      provinceId,
    });

    // Gửi mail xác thực (fire-and-forget, không block response)
    void this.mailService.sendVerificationEmail(
      email,
      candidate.fullName,
      verificationToken,
    );

    return {
      message:
        'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
      user: {
        id: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
        isEmailVerified: false,
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

    const verificationToken = this.generateVerificationToken();

    const user = this.userRepository.create({
      email,
      password,
      role: UserRole.EMPLOYER,
      emailVerificationToken: verificationToken,
      isEmailVerified: false,
    });
    const savedUser = await this.userRepository.save(user);

    // Gửi mail xác thực (fire-and-forget)
    void this.mailService.sendVerificationEmail(
      email,
      email, // Employer chưa có fullName tại bước này
      verificationToken,
    );

    return {
      message:
        'Tài khoản Employer được tạo thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
      user: {
        id: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
        isEmailVerified: false,
      },
    };
  }

  /**
   * Xác thực email từ token trong link
   */
  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Token xác thực không hợp lệ');
    }

    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new NotFoundException(
        'Token không hợp lệ hoặc đã được sử dụng trước đó',
      );
    }

    if (user.isEmailVerified) {
      return { message: 'Email đã được xác thực trước đó' };
    }

    await this.userRepository.update(user.id, {
      isEmailVerified: true,
      emailVerificationToken: null,
    });

    return {
      message:
        'Xác thực email thành công! Tài khoản của bạn đã được kích hoạt.',
    };
  }

  /**
   * Gửi lại email xác thực (yêu cầu đăng nhập)
   */
  async resendVerificationEmail(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');

    if (user.isEmailVerified) {
      throw new BadRequestException('Email đã được xác thực rồi');
    }

    // Tạo token mới
    const newToken = this.generateVerificationToken();
    await this.userRepository.update(userId, {
      emailVerificationToken: newToken,
    });

    // Lấy tên hiển thị
    const displayName = user.email;
    void this.mailService.sendVerificationEmail(
      user.email,
      displayName,
      newToken,
    );

    return {
      message: 'Email xác thực đã được gửi lại. Vui lòng kiểm tra hộp thư.',
    };
  }

  /**
   * Kiểm tra user đã xác thực email chưa (dùng trong VerifiedEmailGuard)
   */
  async checkEmailVerified(userId: number): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'isEmailVerified'],
    });
    return user?.isEmailVerified ?? false;
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

    // Cho phép đăng nhập dù chưa verify — FE sẽ biết thông qua data request và hiển thị banner yêu cầu verify.
    // Lớp bảo vệ thực sự nằm ở `VerifiedEmailGuard` chặn các tài nguyên quan trọng.

    return user;
  }

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
    const hashedToken = await bcrypt.hash(token, 10);
    const expiresAt = new Date();
    // Giả sử refresh token hết hạn sau 7 ngày (đồng bộ với JWT config)
    expiresAt.setDate(expiresAt.getDate() + 7);

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
    if (!user) throw new ConflictException('User not found');

    // O(1) Lookup: Tìm chính xác bản ghi theo JTI (ID)
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { id: jti, userId, isRevoked: false },
    });

    if (!tokenRecord) {
      throw new ConflictException('Invalid Refresh Token');
    }

    // Verify hash (Security Layer)
    const isMatch = await bcrypt.compare(rawRefreshToken, tokenRecord.token);
    if (!isMatch) {
      throw new ConflictException('Invalid Refresh Token Content');
    }

    // Xoay vòng (Rotation): Xóa bản ghi cũ
    await this.refreshTokenRepository.remove(tokenRecord);

    // Tạo cặp mới
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
    const jti = crypto.randomUUID();
    const tokens = await this.generateTokenPair(user, jti);
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      jti,
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

    // 4. Trả về Token Admin (Admin không yêu cầu verify email)
    const result = await this.login(user);
    return result;
  }

  // ---------------------
  // PRIVATE HELPERS
  // ---------------------

  private generateVerificationToken(): string {
    // Tạo 32 random bytes → hex string 64 ký tự
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
