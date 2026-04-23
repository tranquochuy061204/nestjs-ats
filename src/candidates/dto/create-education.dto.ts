import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Degree } from '../../common/enums/degree.enum';

const CreateEducationSchema = z.object({
  schoolName: z.string().trim().min(1, 'Tên trường là bắt buộc').max(255),
  major: z.string().trim().max(255).optional(),
  degree: z.nativeEnum(Degree).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isStillStudying: z.boolean().optional(),
  description: z.string().max(2000, 'Mô tả quá dài').optional(),
});

export class CreateEducationDto extends createZodDto(CreateEducationSchema) {
  @ApiProperty({
    description: 'Tên trường học / đại học',
    example: 'Đại học Bách Khoa TP.HCM',
  })
  schoolName: string;

  @ApiPropertyOptional({
    description: 'Chuyên ngành',
    example: 'Khoa học Máy tính',
  })
  major?: string;

  @ApiPropertyOptional({
    description: 'Bằng cấp/Học vị',
    enum: Degree,
    default: Degree.NONE,
  })
  degree?: Degree;

  @ApiPropertyOptional({
    description: 'Ngày bắt đầu (YYYY-MM-DD)',
    example: '2019-09-01',
  })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc (YYYY-MM-DD)',
    example: '2023-06-30',
  })
  endDate?: string;

  @ApiPropertyOptional({ description: 'Vẫn đang theo học?', example: false })
  isStillStudying?: boolean;

  @ApiPropertyOptional({
    description: 'Thông tin thêm về quá trình học tập',
    example: 'Tốt nghiệp loại giỏi, GPA 3.5/4.0',
  })
  description?: string;
}
