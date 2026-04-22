import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const ResetPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ').max(255),
  token: z.string().min(1, 'Mã xác nhận là bắt buộc').max(20),
  newPassword: z
    .string()
    .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự')
    .max(100, 'Mật khẩu quá dài')
    .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 chữ số'),
});

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {
  @ApiProperty({
    description: 'Email của người dùng',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Mã PIN gồm 6 số gửi qua email',
    example: '123456',
  })
  token: string;

  @ApiProperty({
    description: 'Mật khẩu mới (tối thiểu 6 ký tự)',
    example: 'newpassword123',
    minLength: 6,
  })
  newPassword: string;
}
