import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { MailService } from '../../mail/mail.service';
import { generateVerificationToken } from '../../common/utils/crypto.util';

@Injectable()
export class AuthVerificationService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly mailService: MailService,
  ) {}

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Token xác thực không hợp lệ');
    }

    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
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

  async resendVerificationEmail(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');

    if (user.isEmailVerified) {
      throw new BadRequestException('Email đã được xác thực rồi');
    }

    const newToken = generateVerificationToken();
    await this.userRepository.update(userId, {
      emailVerificationToken: newToken,
    });

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

  async checkEmailVerified(userId: number): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'isEmailVerified'],
    });
    return user?.isEmailVerified ?? false;
  }
}
