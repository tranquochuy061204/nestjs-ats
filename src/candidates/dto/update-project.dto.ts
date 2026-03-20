import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const UpdateProjectSchema = z.object({
  name: z.string().max(255).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

export class UpdateProjectDto extends createZodDto(UpdateProjectSchema) {
  @ApiPropertyOptional({
    description: 'Tên dự án',
    example: 'Hệ thống quản lý tuyển dụng',
  })
  name?: string;

  @ApiPropertyOptional({
    description: 'Ngày bắt đầu (YYYY-MM-DD)',
    example: '2023-03-01',
  })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc (YYYY-MM-DD)',
    example: '2023-12-31',
  })
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Mô tả vai trò và kết quả trong dự án',
    example: 'Thiết kế và phát triển module quản lý ứng viên',
  })
  description?: string;
}
