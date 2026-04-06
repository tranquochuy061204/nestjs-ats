import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const ApplicationFilterSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),
  status: z.string().optional(),
});

export class ApplicationFilterDto extends createZodDto(
  ApplicationFilterSchema,
) {
  @ApiPropertyOptional({ description: 'Trang hiện tại', default: 1 })
  page: number;

  @ApiPropertyOptional({ description: 'Số bản ghi trên trang', default: 10 })
  limit: number;

  @ApiPropertyOptional({
    description:
      'Lọc theo trạng thái (applied, shortlisted, skill_test, interview, offer, hired, rejected, withdrawn)',
  })
  status?: string;
}
