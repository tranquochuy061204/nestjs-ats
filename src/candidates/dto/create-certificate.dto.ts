import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const CreateCertificateSchema = z.object({
  name: z.string().max(255).min(1, 'Tên chứng chỉ là bắt buộc'),
});

export class CreateCertificateDto extends createZodDto(
  CreateCertificateSchema,
) {
  @ApiProperty({
    description: 'Tên chứng chỉ',
    example: 'AWS Certified Solutions Architect',
  })
  name: string;
}
