import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const UpdateWorkExperienceSchema = z.object({
  companyName: z.string().max(255).optional(),
  position: z.string().max(255).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isWorkingHere: z.boolean().optional(),
  description: z.string().optional(),
});

export class UpdateWorkExperienceDto extends createZodDto(
  UpdateWorkExperienceSchema,
) {
  @ApiPropertyOptional({ description: 'Tên công ty', example: 'FPT Software' })
  companyName?: string;

  @ApiPropertyOptional({
    description: 'Vị trí / chức danh',
    example: 'Backend Developer',
  })
  position?: string;

  @ApiPropertyOptional({
    description: 'Ngày bắt đầu (YYYY-MM-DD)',
    example: '2023-01-15',
  })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc (YYYY-MM-DD)',
    example: '2024-06-30',
  })
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Hiện tại vẫn đang làm ở đây?',
    example: false,
  })
  isWorkingHere?: boolean;

  @ApiPropertyOptional({
    description: 'Mô tả công việc đã thực hiện',
    example: 'Phát triển REST API cho hệ thống quản lý nhân sự',
  })
  description?: string;
}
