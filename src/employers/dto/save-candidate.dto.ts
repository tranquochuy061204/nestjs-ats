import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const SaveCandidateSchema = z.object({
  note: z.string().optional(),
});

export class SaveCandidateDto extends createZodDto(SaveCandidateSchema) {
  @ApiPropertyOptional({
    description: 'Ghi chú về ứng viên này',
    example: 'Ứng viên tiềm năng cho vị trí Backend',
  })
  note?: string;
}
