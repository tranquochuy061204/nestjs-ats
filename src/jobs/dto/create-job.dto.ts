import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { sanitizeRichText } from '../../common/utils/sanitize.util';

export const CreateJobSchema = z.object({
  title: z.string().min(1, 'Tiêu đề là bắt buộc').max(255),

  // Santize rich text inputs
  description: z.string().min(1, 'Mô tả là bắt buộc').transform(sanitizeRichText),
  requirements: z.string().optional().transform((val) => val ? sanitizeRichText(val) : undefined),
  benefits: z.string().optional().transform((val) => val ? sanitizeRichText(val) : undefined),

  salaryMin: z.number().int().nonnegative().optional(),
  salaryMax: z.number().int().nonnegative().optional(),
  currency: z.string().max(10).optional().default('VND'),
  yearsOfExperience: z.number().int().nonnegative().optional(),

  provinceId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  jobTypeId: z.number().int().positive().optional(),

  slots: z.number().int().positive().optional(),
  deadline: z.string().optional().transform((val) => val ? new Date(val) : undefined),

  skills: z.array(z.object({
    skillId: z.number().int().positive().optional(),
    tagText: z.string().max(100).optional()
  })).optional().default([]),
});

export class CreateJobDto extends createZodDto(CreateJobSchema) {
  @ApiProperty({ description: 'Tiêu đề công việc' })
  title: string;

  @ApiProperty({ description: 'Mô tả công việc (HTML/Richtext)' })
  description: string;

  @ApiPropertyOptional({ description: 'Yêu cầu ứng viên (HTML/Richtext)' })
  requirements: string | undefined;

  @ApiPropertyOptional({ description: 'Quyền lợi (HTML/Richtext)' })
  benefits: string | undefined;

  @ApiPropertyOptional({ description: 'Lương tối thiểu' })
  salaryMin: number | undefined;

  @ApiPropertyOptional({ description: 'Lương tối đa' })
  salaryMax: number | undefined;

  @ApiPropertyOptional({ description: 'Loại tiền tệ', default: 'VND' })
  currency: string;

  @ApiPropertyOptional({ description: 'Năm kinh nghiệm' })
  yearsOfExperience: number | undefined;

  @ApiPropertyOptional({ description: 'ID Tỉnh thành' })
  provinceId: number | undefined;

  @ApiPropertyOptional({ description: 'ID Danh mục nghề nghiệp' })
  categoryId: number | undefined;

  @ApiPropertyOptional({ description: 'ID Hình thức (Full-time, Part-time)' })
  jobTypeId: number | undefined;

  @ApiPropertyOptional({ description: 'Số điểm cần tuyển' })
  slots: number | undefined;

  @ApiPropertyOptional({ description: 'Hạn chót nộp hồ sơ (YYYY-MM-DD)' })
  deadline: Date | undefined;

  @ApiPropertyOptional({
    description: 'Danh sách kỹ năng (tag chữ hoặc metadata ID)',
    type: 'array',
    example: [{ skillId: 1 }, { tagText: 'NestJS' }]
  })
  skills: { skillId?: number; tagText?: string }[];
}
