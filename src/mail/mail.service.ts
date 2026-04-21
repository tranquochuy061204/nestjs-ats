import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  /**
   * Gửi email xác thực tài khoản sau khi đăng ký
   */
  async sendVerificationEmail(email: string, fullName: string, token: string) {
    const verifyUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/auth/verify-email?token=${token}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: '[ATS] Xác thực địa chỉ email của bạn',
        template: 'verify-email',
        context: {
          name: fullName || email,
          verifyUrl,
          expiresIn: '24 giờ',
        },
      });
      this.logger.log(`Verification email sent to ${email}`);
    } catch (err) {
      // Không throw — tránh chặn flow đăng ký nếu mail lỗi
      this.logger.error(`Failed to send verification email to ${email}`, err);
    }
  }

  /**
   * Gửi email đặt lại mật khẩu (dùng cho Phase 2 - Account Management)
   */
  async sendPasswordResetEmail(email: string, fullName: string, token: string) {
    const resetUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/auth/reset-password?token=${token}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: '[ATS] Yêu cầu đặt lại mật khẩu',
        template: 'reset-password',
        context: {
          name: fullName || email,
          resetUrl,
          expiresIn: '15 phút',
        },
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}`, err);
    }
  }
}
