import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const UpdateCertificateSchema = z.object({
  name: z.string().min(1, 'Tên chứng chỉ là bắt buộc').max(255).optional(),
});

export class UpdateCertificateDto extends createZodDto(
  UpdateCertificateSchema,
) {
  @ApiPropertyOptional({
    description: 'Tên chứng chỉ',
    example: 'AWS Certified Solutions Architect',
  })
  name?: string;
}
