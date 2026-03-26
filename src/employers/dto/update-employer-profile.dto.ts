import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const UpdateEmployerProfileSchema = z.object({
  fullName: z.string().optional(),
  phoneContact: z.string().optional(),
});

export class UpdateEmployerProfileDto extends createZodDto(
  UpdateEmployerProfileSchema,
) {
  @ApiPropertyOptional({ description: 'Họ và tên HR' })
  fullName?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại liên hệ' })
  phoneContact?: string;
}
