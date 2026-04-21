import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const ChangePasswordSchema = z.object({
  oldPassword: z.string().nonempty('Old password is required'),
  newPassword: z
    .string({ error: 'New password is required' })
    .min(6, 'Password must be at least 6 characters long'),
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
