import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const HeadhuntingFilterSchema = z.object({
  keyword: z.string().max(100, 'Từ khóa quá dài').optional(),
  provinceId: z.coerce.number().int().positive().optional(),
  jobCategoryId: z.coerce.number().int().positive().optional(),
  jobTypeId: z.coerce.number().int().positive().optional(),
  minExperience: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export class HeadhuntingFilterDto extends createZodDto(
  HeadhuntingFilterSchema,
) {
  @ApiPropertyOptional({
    description: 'Từ khóa tìm kiếm (tên, vị trí, bio)',
    example: 'Nodejs',
  })
  keyword?: string;

  @ApiPropertyOptional({
    description: 'ID Tỉnh/Thành phố',
    example: 1,
  })
  provinceId?: number;

  @ApiPropertyOptional({
    description: 'ID Ngành nghề (Job Category)',
    example: 1,
  })
  jobCategoryId?: number;

  @ApiPropertyOptional({
    description: 'ID Cấp bậc / Hình thức làm việc (Job Type)',
    example: 1,
  })
  jobTypeId?: number;

  @ApiPropertyOptional({
    description: 'Số năm kinh nghiệm tối thiểu',
    example: 2,
  })
  minExperience?: number;

  @ApiPropertyOptional({
    description: 'Trang hiện tại',
    default: 1,
  })
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng item mỗi trang',
    default: 10,
  })
  limit: number = 10;
}
