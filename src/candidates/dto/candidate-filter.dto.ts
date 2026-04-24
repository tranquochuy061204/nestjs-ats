import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PAGINATION_DEFAULTS } from '../../common/constants/headhunting.constant';
import { VALIDATION_LIMITS } from '../../common/constants/validation.constant';
import { CandidateSortBy, SortOrder } from '../../common/enums/sort-order.enum';

/** Coerce một query param thành number[] (hỗ trợ cả ?id=1&id=2 lẫn ?id=1,2) */
const coerceNumberArray = () =>
  z.union([
    z.coerce
      .number()
      .int()
      .positive()
      .transform((v) => [v]),
    z.string().transform((v) =>
      v
        .split(',')
        .map(Number)
        .filter((n) => n > 0),
    ),
    z.array(z.coerce.number().int().positive()),
  ]);

const CandidateFilterSchema = z.object({
  // ─── Pagination ──────────────────────────────────────────────────────────
  page: z.coerce.number().int().min(1).default(PAGINATION_DEFAULTS.PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION_DEFAULTS.MAX_LIMIT)
    .default(PAGINATION_DEFAULTS.LIMIT),

  // ─── Text search ─────────────────────────────────────────────────────────
  /** Tìm theo tên hoặc vị trí mong muốn */
  keyword: z.string().max(VALIDATION_LIMITS.NAME.MAX).optional(),

  // ─── Filters ─────────────────────────────────────────────────────────────
  /** Tỉnh/thành phố của ứng viên */
  provinceId: z.coerce.number().int().positive().optional(),

  /** Hình thức làm việc mong muốn */
  jobTypeId: z.coerce.number().int().positive().optional(),

  /**
   * Skill IDs — OR logic:
   * Ứng viên phải có ÍT NHẤT 1 skill trong danh sách.
   */
  skillIds: coerceNumberArray().optional(),

  /**
   * Ngành nghề quan tâm — OR logic:
   * Ứng viên phải quan tâm ÍT NHẤT 1 ngành.
   */
  categoryIds: coerceNumberArray().optional(),

  /** Lọc ứng viên có lương kỳ vọng >= salaryMin */
  salaryMin: z.coerce.number().nonnegative().optional(),

  /** Lọc ứng viên có lương kỳ vọng <= salaryMax */
  salaryMax: z.coerce.number().nonnegative().optional(),

  /** Số năm kinh nghiệm tối thiểu */
  minExperience: z.coerce.number().int().nonnegative().optional(),

  // ─── Sorting ─────────────────────────────────────────────────────────────
  sortBy: z
    .enum(
      Object.values(CandidateSortBy) as [CandidateSortBy, ...CandidateSortBy[]],
    )
    .default(CandidateSortBy.CREATED_AT),
  sortOrder: z
    .enum(Object.values(SortOrder) as [SortOrder, ...SortOrder[]])
    .default(SortOrder.DESC),
});

export class CandidateFilterDto extends createZodDto(CandidateFilterSchema) {
  @ApiPropertyOptional({ description: 'Trang hiện tại', default: 1 })
  page: number;

  @ApiPropertyOptional({ description: 'Số bản ghi trên trang', default: 10 })
  limit: number;

  @ApiPropertyOptional({
    description: 'Từ khóa tìm kiếm (theo tên hoặc vị trí mong muốn)',
  })
  keyword: string | undefined;

  @ApiPropertyOptional({ description: 'Tỉnh/thành phố của ứng viên' })
  provinceId: number | undefined;

  @ApiPropertyOptional({ description: 'Hình thức làm việc mong muốn' })
  jobTypeId: number | undefined;

  @ApiPropertyOptional({
    description: 'Skill IDs (OR logic). VD: skillIds=1&skillIds=2',
    isArray: true,
    type: Number,
  })
  skillIds: number[] | undefined;

  @ApiPropertyOptional({
    description:
      'Ngành nghề quan tâm (OR logic). VD: categoryIds=1&categoryIds=2',
    isArray: true,
    type: Number,
  })
  categoryIds: number[] | undefined;

  @ApiPropertyOptional({
    description:
      'Lương kỳ vọng tối thiểu của ứng viên (candidate.salaryMin >= salaryMin)',
  })
  salaryMin: number | undefined;

  @ApiPropertyOptional({
    description:
      'Lương kỳ vọng tối đa của ứng viên (candidate.salaryMax <= salaryMax)',
  })
  salaryMax: number | undefined;

  @ApiPropertyOptional({ description: 'Số năm kinh nghiệm tối thiểu' })
  minExperience: number | undefined;

  @ApiPropertyOptional({
    description: 'Trường sắp xếp',
    enum: CandidateSortBy,
    default: CandidateSortBy.CREATED_AT,
  })
  sortBy: CandidateSortBy;

  @ApiPropertyOptional({
    description: 'Chiều sắp xếp',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  sortOrder: SortOrder;
}
