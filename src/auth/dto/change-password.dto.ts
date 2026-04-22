import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Mật khẩu cũ là bắt buộc'),
  newPassword: z
    .string()
    .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự')
    .max(100, 'Mật khẩu quá dài')
    .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 chữ số'),
});

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {
  @ApiProperty({
    description: 'Mật khẩu hiện tại',
    example: 'oldpassword123',
  })
  oldPassword: string;

  @ApiProperty({
    description: 'Mật khẩu mới (tối thiểu 6 ký tự)',
    example: 'newpassword123',
    minLength: 6,
  })
  newPassword: string;
}
