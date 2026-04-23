import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';
import { VALIDATION_LIMITS } from '../../common/constants/validation.constant';

const RegisterSchema = z.object({
  email: z.email('Email không hợp lệ').max(VALIDATION_LIMITS.EMAIL.MAX),
  password: z
    .string()
    .min(
      VALIDATION_LIMITS.PASSWORD.MIN,
      `Mật khẩu phải có ít nhất ${VALIDATION_LIMITS.PASSWORD.MIN} ký tự`,
    )
    .max(VALIDATION_LIMITS.PASSWORD.MAX, 'Mật khẩu quá dài')
    .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 chữ số'),
  firstName: z
    .string()
    .min(VALIDATION_LIMITS.NAME.MIN, 'Tên không được để trống')
    .max(VALIDATION_LIMITS.NAME.MAX),
  lastName: z
    .string()
    .min(VALIDATION_LIMITS.NAME.MIN, 'Họ không được để trống')
    .max(VALIDATION_LIMITS.NAME.MAX),
  phone: z
    .string()
    .min(
      VALIDATION_LIMITS.PHONE.MIN,
      `Số điện thoại phải có ít nhất ${VALIDATION_LIMITS.PHONE.MIN} số`,
    )
    .max(VALIDATION_LIMITS.PHONE.MAX, 'Số điện thoại quá dài'),
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
