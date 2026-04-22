import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '../entities/job.entity';

const JobFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  keyword: z.string().max(100).optional(),
  provinceId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  jobTypeId: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(JobStatus).optional(),
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

  @ApiPropertyOptional({
    description: 'Lọc theo status (dùng cho nội bộ HR)',
    enum: JobStatus,
  })
  status: JobStatus | undefined;
}
