import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const RegisterSchema = z.object({
  email: z.email('Email is invalid').nonempty('Email is required'),
  password: z
    .string({ error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters long'),
  firstName: z
    .string({ error: 'First name is required' })
    .nonempty('First name is required'),
  lastName: z
    .string({ error: 'Last name is required' })
    .nonempty('Last name is required'),
  phone: z
    .string({ error: 'Phone is must be a number' })
    .min(10, 'Phone must be at least 10 digits long')
    .nonempty('Phone is required'),
  provinceId: z.number({ error: 'Province is required' }),
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
