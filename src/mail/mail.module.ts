/* eslint-disable @typescript-eslint/no-require-imports */
import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { MailService } from './mail.service';

// Lazy require để tránh lỗi TypeScript với @nestjs-modules/mailer v2.x
const getAdapter = () =>
  require('@nestjs-modules/mailer/adapters/handlebars.adapter')
    .HandlebarsAdapter;

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const HandlebarsAdapter = getAdapter();
        return {
          transport: {
            host: configService.get<string>('MAIL_HOST'),
            port: Number(configService.get('MAIL_PORT') ?? 587),
            secure: configService.get<string>('MAIL_SECURE') === 'true',
            auth: {
              user: configService.get<string>('MAIL_USER'),
              pass: configService.get<string>('MAIL_PASS'),
            },
          },
          defaults: {
            from:
              configService.get<string>('MAIL_FROM') ??
              '"ATS System" <no-reply@ats.com>',
          },
          template: {
            // Sử dụng path tương đối từ root dự án để đảm bảo tìm thấy template
            // Cho dù chạy từ `src` (nest start) hay `dist` (node dist/main)
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter() as never,
            options: { strict: true },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
