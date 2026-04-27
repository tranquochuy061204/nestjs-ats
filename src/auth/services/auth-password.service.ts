import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../users/entities/user.entity';
import { MailService } from '../../mail/mail.service';
import { AuthTokenService } from './auth-token.service';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { AUTH_CONFIG } from '../../common/constants/auth.constant';

@Injectable()
export class AuthPasswordService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly mailService: MailService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      relations: ['candidate'],
    });

    if (!user) {
      return {
        message: 'Nếu email tồn tại, thư cấp lại mật khẩu đã được gửi.',
      };
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();

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

    await this.authTokenService.logoutAllDevices(user.id);

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

    await this.authTokenService.logoutAllDevices(userId);

    return {
      message:
        'Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên các thiết bị.',
    };
  }
}
