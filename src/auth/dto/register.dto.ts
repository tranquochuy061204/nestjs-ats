import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const RegisterSchema = z.object({
  email: z.string().email('Email không hợp lệ').max(255),
  password: z
    .string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .max(100, 'Mật khẩu quá dài')
    .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 chữ số'),
  firstName: z.string().min(1, 'Tên không được để trống').max(100),
  lastName: z.string().min(1, 'Họ không được để trống').max(100),
  phone: z
    .string()
    .min(10, 'Số điện thoại phải có ít nhất 10 số')
    .max(20, 'Số điện thoại quá dài'),
  provinceId: z.number().int().positive('Tỉnh thành không hợp lệ'),
});

export class RegisterDto extends createZodDto(RegisterSchema) {
  @ApiProperty({ description: 'Email đăng ký', example: 'user@example.com' })
  email: string;

  @ApiProperty({
    description: 'Mật khẩu (tối thiểu 6 ký tự)',
    example: 'password123',
    minLength: 6,
  })
  password: string;

  @ApiProperty({ description: 'Tên', example: 'Văn A' })
  firstName: string;

  @ApiProperty({ description: 'Họ', example: 'Nguyễn' })
  lastName: string;

  @ApiProperty({
    description: 'Số điện thoại (tối thiểu 10 số)',
    example: '0901234567',
    minLength: 10,
  })
  phone: string;

  @ApiProperty({ description: 'ID tỉnh/thành phố', example: 1 })
  provinceId: number;
}
