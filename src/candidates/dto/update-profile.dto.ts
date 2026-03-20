import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const UpdateProfileSchema = z.object({
  fullName: z.string().max(255).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  phone: z.string().max(20).optional(),
  avatarUrl: z.string().max(255).optional(),
  cvUrl: z.string().max(255).optional(),
  bio: z.string().optional(),
  provinceId: z.number().int().optional(),
  position: z.string().max(255).optional(),
  // Triệu
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  jobTypeId: z.number().int().optional(),
  yearWorkingExperience: z.number().int().min(0).optional(),
});

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {
  @ApiPropertyOptional({ description: 'Họ và tên', example: 'Nguyễn Văn A' })
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Giới tính',
    enum: ['male', 'female', 'other'],
    example: 'male',
  })
  gender?: 'male' | 'female' | 'other';

  @ApiPropertyOptional({
    description: 'Số điện thoại',
    example: '0901234567',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'URL ảnh đại diện',
    example: 'https://example.com/avatar.jpg',
  })
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'URL file CV',
    example: 'https://example.com/cv.pdf',
  })
  cvUrl?: string;

  @ApiPropertyOptional({
    description: 'Giới thiệu bản thân',
    example: 'Tôi là lập trình viên...',
  })
  bio?: string;

  @ApiPropertyOptional({
    description: 'ID tỉnh/thành phố',
    example: 1,
  })
  provinceId?: number;

  @ApiPropertyOptional({
    description: 'Vị trí ứng tuyển',
    example: 'Backend Developer',
  })
  position?: string;

  @ApiPropertyOptional({
    description: 'Mức lương tối thiểu mong muốn (triệu VNĐ)',
    example: 10,
  })
  salaryMin?: number;

  @ApiPropertyOptional({
    description: 'Mức lương tối đa mong muốn (triệu VNĐ)',
    example: 20,
  })
  salaryMax?: number;

  @ApiPropertyOptional({
    description: 'ID loại công việc',
    example: 1,
  })
  jobTypeId?: number;

  @ApiPropertyOptional({
    description: 'Số năm kinh nghiệm làm việc',
    example: 2,
    minimum: 0,
  })
  yearWorkingExperience?: number;
}
