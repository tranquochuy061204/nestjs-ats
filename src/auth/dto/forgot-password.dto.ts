import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const ForgotPasswordSchema = z.object({
  email: z.email('Email is invalid').nonempty('Email is required'),
});

export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {
  @ApiProperty({
    description: 'Email đăng ký tài khoản cần khôi phục mật khẩu',
    example: 'user@example.com',
  })
  email: string;
}
