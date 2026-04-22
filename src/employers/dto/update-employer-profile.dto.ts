import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const UpdateEmployerProfileSchema = z.object({
  fullName: z.string().max(100, 'Họ tên quá dài').optional(),
  phoneContact: z.string().max(20, 'Số điện thoại quá dài').optional(),
});

export class UpdateEmployerProfileDto extends createZodDto(
  UpdateEmployerProfileSchema,
) {
  @ApiPropertyOptional({ description: 'Họ và tên HR' })
  fullName?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại liên hệ' })
  phoneContact?: string;
}
