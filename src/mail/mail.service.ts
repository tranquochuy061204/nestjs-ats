import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Gửi email xác thực tài khoản sau khi đăng ký
   */
  async sendVerificationEmail(email: string, fullName: string, token: string) {
    const backendUrl =
      this.configService.get<string>('BACKEND_URL') || 'http://localhost:3000';
    const verifyUrl = `${backendUrl}/api/auth/verify-email?token=${token}`;

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
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: '[ATS] Yêu cầu đặt lại mật khẩu',
        template: 'reset-password',
        context: {
          name: fullName || email,
          token,
        },
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}`, err);
    }
  }

  /**
   * Gửi email thông báo thay đổi trạng thái đơn ứng tuyển
   */
  async sendApplicationStatusEmail(
    email: string,
    name: string,
    jobTitle: string,
    status: string,
    companyName: string,
    actionUrl: string,
    reason?: string,
  ) {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `[ATS] Cập nhật trạng thái ứng tuyển: ${jobTitle}`,
        template: 'application-status',
        context: {
          name,
          jobTitle,
          status,
          companyName,
          actionUrl,
          reason,
        },
      });
      this.logger.log(`Application status email sent to ${email}`);
    } catch (err) {
      this.logger.error(
        `Failed to send application status email to ${email}`,
        err,
      );
    }
  }

  /**
   * Gửi email mời ứng tuyển (Headhunting)
   */
  async sendJobInvitationEmail(
    email: string,
    name: string,
    jobTitle: string,
    companyName: string,
    actionUrl: string,
    message?: string,
  ) {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `[ATS] Cơ hội nghề nghiệp mới từ ${companyName}`,
        template: 'job-invitation',
        context: {
          name,
          jobTitle,
          companyName,
          actionUrl,
          message,
        },
      });
      this.logger.log(`Job invitation email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send job invitation email to ${email}`, err);
    }
  }
}
