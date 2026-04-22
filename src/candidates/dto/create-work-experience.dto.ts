import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const CreateWorkExperienceSchema = z.object({
  companyName: z.string().trim().min(1, 'Tên công ty là bắt buộc').max(255),
  position: z.string().trim().min(1, 'Vị trí là bắt buộc').max(255),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isWorkingHere: z.boolean().optional(),
  description: z.string().max(2000, 'Mô tả quá dài').optional(),
});

export class CreateWorkExperienceDto extends createZodDto(
  CreateWorkExperienceSchema,
) {
  @ApiProperty({ description: 'Tên công ty', example: 'FPT Software' })
  companyName: string;

  @ApiProperty({
    description: 'Vị trí / chức danh',
    example: 'Backend Developer',
  })
  position: string;

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
