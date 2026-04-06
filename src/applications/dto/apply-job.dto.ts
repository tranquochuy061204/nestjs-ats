import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const ApplyJobSchema = z.object({
  coverLetter: z.string().max(5000).optional(),
});

export class ApplyJobDto extends createZodDto(ApplyJobSchema) {
  @ApiPropertyOptional({
    description: 'Thư xin việc (tùy chọn)',
    maxLength: 5000,
  })
  coverLetter?: string;
}
