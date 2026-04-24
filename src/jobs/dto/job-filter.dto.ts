import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '../entities/job.entity';
import { PAGINATION_DEFAULTS } from '../../common/constants/headhunting.constant';
import { VALIDATION_LIMITS } from '../../common/constants/validation.constant';
import { Degree } from '../../common/enums/degree.enum';
import { JobSortBy, SortOrder } from '../../common/enums/sort-order.enum';

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

const JobFilterSchema = z.object({
  // ─── Pagination ──────────────────────────────────────────────────────────
  page: z.coerce.number().int().min(1).default(PAGINATION_DEFAULTS.PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION_DEFAULTS.MAX_LIMIT)
    .default(PAGINATION_DEFAULTS.LIMIT),

  // ─── Text search ─────────────────────────────────────────────────────────
  /** Tìm theo title (và description nếu keyword > 3 ký tự) */
  keyword: z.string().max(VALIDATION_LIMITS.NAME.MAX).optional(),

  // ─── Basic filters (existing) ────────────────────────────────────────────
  provinceId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  jobTypeId: z.coerce.number().int().positive().optional(),

  // ─── Advanced filters (new) ──────────────────────────────────────────────
  /** Lọc theo cấp bậc (Junior / Senior / Manager…) */
  levelId: z.coerce.number().int().positive().optional(),

  /** Salary overlap: job phải có lương giao thoa với khoảng này */
  salaryMin: z.coerce.number().nonnegative().optional(),
  salaryMax: z.coerce.number().nonnegative().optional(),

  /** Bằng cấp yêu cầu tối thiểu */
  requiredDegree: z
    .enum(Object.values(Degree) as [Degree, ...Degree[]])
    .optional(),

  /** Số năm kinh nghiệm tối đa job yêu cầu (UV lọc theo khả năng của mình) */
  maxYearsRequired: z.coerce.number().int().nonnegative().optional(),

  /**
   * Skill IDs — OR logic:
   * Job phải có ÍT NHẤT 1 skill trong danh sách.
   * Truyền dưới dạng query: skillIds=1&skillIds=2 hoặc skillIds=1,2
   */
  skillIds: coerceNumberArray().optional(),

  /** Chỉ hiển thị job còn trong hạn nộp hồ sơ */
  hasDeadline: z.coerce.boolean().optional(),

  // ─── Admin/internal ──────────────────────────────────────────────────────
  status: z
    .enum(Object.values(JobStatus) as [JobStatus, ...JobStatus[]])
    .optional(),

  // ─── Sorting ─────────────────────────────────────────────────────────────
  sortBy: z
    .enum(Object.values(JobSortBy) as [JobSortBy, ...JobSortBy[]])
    .default(JobSortBy.CREATED_AT),
  sortOrder: z
    .enum(Object.values(SortOrder) as [SortOrder, ...SortOrder[]])
    .default(SortOrder.DESC),
});

export class JobFilterDto extends createZodDto(JobFilterSchema) {
  @ApiPropertyOptional({ description: 'Trang hiện tại', default: 1 })
  page: number;

  @ApiPropertyOptional({ description: 'Số bản ghi trên trang', default: 10 })
  limit: number;

  @ApiPropertyOptional({
    description: 'Từ khóa tìm kiếm (title + description)',
  })
  keyword: string | undefined;

  @ApiPropertyOptional({ description: 'Lọc theo ID tỉnh/thành phố' })
  provinceId: number | undefined;

  @ApiPropertyOptional({ description: 'Lọc theo danh mục ngành nghề' })
  categoryId: number | undefined;

  @ApiPropertyOptional({
    description: 'Lọc theo hình thức (Full-time, Part-time)',
  })
  jobTypeId: number | undefined;

  @ApiPropertyOptional({ description: 'Lọc theo cấp bậc (levelId)' })
  levelId: number | undefined;

  @ApiPropertyOptional({
    description:
      'Lương tối thiểu mong muốn (overlap: job.salaryMax >= salaryMin)',
  })
  salaryMin: number | undefined;

  @ApiPropertyOptional({
    description: 'Lương tối đa mong muốn (overlap: job.salaryMin <= salaryMax)',
  })
  salaryMax: number | undefined;

  @ApiPropertyOptional({ description: 'Bằng cấp yêu cầu', enum: Degree })
  requiredDegree: Degree | undefined;

  @ApiPropertyOptional({
    description: 'Job yêu cầu tối đa bao nhiêu năm kinh nghiệm',
  })
  maxYearsRequired: number | undefined;

  @ApiPropertyOptional({
    description:
      'Skill IDs (OR logic — job có ít nhất 1 skill). VD: skillIds=1&skillIds=2',
    isArray: true,
    type: Number,
  })
  skillIds: number[] | undefined;

  @ApiPropertyOptional({
    description: 'Chỉ hiển thị job còn trong hạn nộp (deadline > now)',
  })
  hasDeadline: boolean | undefined;

  @ApiPropertyOptional({
    description: 'Lọc theo status (dùng cho nội bộ HR)',
    enum: JobStatus,
  })
  status: JobStatus | undefined;

  @ApiPropertyOptional({
    description: 'Trường sắp xếp',
    enum: JobSortBy,
    default: JobSortBy.CREATED_AT,
  })
  sortBy: JobSortBy;

  @ApiPropertyOptional({
    description: 'Chiều sắp xếp',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  sortOrder: SortOrder;
}
