import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const JobFilterSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => Math.min(val ? parseInt(val, 10) : 10, 100)),
  keyword: z.string().max(100).optional(),
  provinceId: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  categoryId: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  jobTypeId: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  status: z.string().optional(),
});

export class JobFilterDto extends createZodDto(JobFilterSchema) {
  @ApiPropertyOptional({ description: 'Trang hiện tại', default: 1 })
  page: number;

  @ApiPropertyOptional({ description: 'Số bản ghi trên trang', default: 10 })
  limit: number;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (theo tên job)' })
  keyword: string | undefined;

  @ApiPropertyOptional({ description: 'Lọc theo ID tỉnh/thành phố' })
  provinceId: number | undefined;

  @ApiPropertyOptional({ description: 'Lọc theo danh mục ngành nghề' })
  categoryId: number | undefined;

  @ApiPropertyOptional({
    description: 'Lọc theo hình thức (Full-time, Part-time)',
  })
  jobTypeId: number | undefined;

  @ApiPropertyOptional({ description: 'Lọc theo status (dùng cho nội bộ HR)' })
  status: string | undefined;
}
