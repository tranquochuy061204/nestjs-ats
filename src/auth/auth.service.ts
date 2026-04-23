import {
  Injectable,
  ConflictException,
  Inject,
  forwardRef,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, UserRole } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { RegisterEmployerDto } from './dto/register-employer.dto';
import { CandidateProfileService } from '../candidates/services/candidate-profile.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { Response } from 'express';
import { MailService } from '../mail/mail.service';
import { AUTH_CONFIG } from '../common/constants/auth.constant';

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
      // Trả về 200 OK nếu không tìm thấy token (thường do click 2 lần hoặc tự động prefetch)
      // Để không quăng lỗi, tránh hiểu lầm là quá trình xác thực thất bại.
      return {
        message:
          'Email đã được xác thực thành công hoặc token đã được sử dụng.',
        isEmailVerified: true,
      };
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
    const hashedToken = await bcrypt.hash(token, AUTH_CONFIG.SALT_ROUNDS);
    const expiresAt = new Date();
    // Đọc từ config để đồng bộ với JWT_REFRESH_EXPIRES_TIME (vd: '7d', '14d', '30d')
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

    // O(1) Lookup: Tìm chính xác bản ghi theo JTI (ID)
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { id: jti, userId, isRevoked: false },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    // Verify hash (Security Layer)
    const isMatch = await bcrypt.compare(rawRefreshToken, tokenRecord.token);
    if (!isMatch) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
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
        isEmailVerified: user.isEmailVerified,
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
      throw new ForbiddenException('Tài khoản không có quyền quản trị');
    }

    // 3. So khớp password (chỉ dành cho Admin)
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Mật khẩu không chính xác');
    }

    // 4. Trả về Token Admin (Admin không yêu cầu verify email)
    const result = await this.login(user);
    return result;
  }

  // ---------------------
  // ACCOUNT MANAGEMENT (PHASE 2)
  // ---------------------

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      relations: ['candidate'],
    });

    // Luôn trả về thông báo thành công dù email không tồn tại (Bảo mật: ngăn chặn dò quét email)
    if (!user) {
      return {
        message: 'Nếu email tồn tại, thư cấp lại mật khẩu đã được gửi.',
      };
    }

    // Generate 6-digit OTP
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP before storing
    const hashedPin = await bcrypt.hash(pin, AUTH_CONFIG.SALT_ROUNDS);
    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + AUTH_CONFIG.RESET_PASSWORD_EXPIRES_MIN,
    );

    await this.userRepository.update(user.id, {
      resetPasswordToken: hashedPin,
      resetPasswordExpires: expiresAt,
    });

    const displayName = user.candidate?.fullName || user.email;
    void this.mailService.sendPasswordResetEmail(user.email, displayName, pin);

    return {
      message: 'Nếu email tồn tại, thư cấp lại mật khẩu đã được gửi.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user || !user.resetPasswordToken || !user.resetPasswordExpires) {
      throw new BadRequestException('Yêu cầu không hợp lệ hoặc đã hết hạn.');
    }

    if (new Date() > user.resetPasswordExpires) {
      throw new BadRequestException('Mã xác nhận đã hết hạn.');
    }

    const isValid = await bcrypt.compare(dto.token, user.resetPasswordToken);
    if (!isValid) {
      throw new BadRequestException('Mã xác nhận không đúng.');
    }

    const newHashedPassword = await bcrypt.hash(
      dto.newPassword,
      AUTH_CONFIG.SALT_ROUNDS,
    );
    await this.userRepository.update(user.id, {
      password: newHashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });

    // Force Logout All Devices
    await this.logoutAllDevices(user.id);

    return { message: 'Cập nhật mật khẩu thành công. Vui lòng đăng nhập lại.' };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User không tồn tại');

    const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu cũ không chính xác.');
    }

    const newHashedPassword = await bcrypt.hash(
      dto.newPassword,
      AUTH_CONFIG.SALT_ROUNDS,
    );
    await this.userRepository.update(userId, {
      password: newHashedPassword,
    });

    // Force Logout All Devices
    await this.logoutAllDevices(userId);

    return {
      message:
        'Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên các thiết bị.',
    };
  }

  async logoutAllDevices(userId: number) {
    await this.refreshTokenRepository.delete({ userId });
    return { message: 'Đã đăng xuất khỏi tất cả thiết bị.' };
  }

  // ---------------------
  // PRIVATE HELPERS
  // ---------------------

  private generateVerificationToken(): string {
    // Tạo 32 random bytes → hex string 64 ký tự
    const array = new Uint8Array(AUTH_CONFIG.VERIFICATION_TOKEN_BYTES);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
