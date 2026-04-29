import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const LoginSchema = z.object({
  email: z.email('Email is invalid'),
  password: z
    .string({ error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters long'),
});

export class LoginDto extends createZodDto(LoginSchema) {
  @ApiProperty({ description: 'Email đăng nhập', example: 'user@example.com' })
  email: string;

  @ApiProperty({
    description: 'Mật khẩu (tối thiểu 6 ký tự)',
    example: 'password123',
    minLength: 6,
  })
  password: string;
}
