import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const SuggestionFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export class SuggestionFilterDto extends createZodDto(SuggestionFilterSchema) {
  @ApiPropertyOptional({ description: 'Trang hiện tại', default: 1 })
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Số ứng viên mỗi trang (tối đa 50)',
    default: 20,
  })
  limit: number = 20;
}
