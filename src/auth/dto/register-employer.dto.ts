import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const RegisterEmployerSchema = z.object({
  email: z.string().email('Email không hợp lệ').max(255),
  password: z
    .string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .max(100, 'Mật khẩu quá dài')
    .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 chữ số'),
});

export class RegisterEmployerDto extends createZodDto(RegisterEmployerSchema) {
  @ApiProperty({
    description: 'Email đăng ký của HR',
    example: 'hr@company.com',
  })
  email: string;

  @ApiProperty({
    description: 'Mật khẩu (tối thiểu 6 ký tự)',
    example: 'password123',
    minLength: 6,
  })
  password: string;
}
