import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const CreateEducationSchema = z.object({
  schoolName: z.string().max(255).nonempty('Tên trường là bắt buộc'),
  major: z.string().max(255).optional(),
  degree: z.string().max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isStillStudying: z.boolean().optional(),
  description: z.string().optional(),
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

  @ApiPropertyOptional({ description: 'Bằng cấp', example: 'Cử nhân' })
  degree?: string;

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
