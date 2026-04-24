import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const UpdateProfileSchema = z
  .object({
    fullName: z.string().max(255).optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    phone: z.string().max(20).optional(),
    bio: z.string().max(2000).optional(),
    provinceId: z.number().int().optional(),
    position: z.string().max(255).optional(),
    // Triệu
    salaryMin: z.number().nonnegative().optional(),
    salaryMax: z.number().nonnegative().optional(),
    jobTypeId: z.number().int().optional(),
    yearWorkingExperience: z.number().int().min(0).optional(),
    isPublic: z.boolean().optional(),
    linkedinUrl: z.url().max(255).optional().or(z.literal('')),
    githubUrl: z.url().max(255).optional().or(z.literal('')),
    portfolioUrl: z.url().max(255).optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      if (data.salaryMin !== undefined && data.salaryMax !== undefined) {
        return data.salaryMin <= data.salaryMax;
      }
      return true;
    },
    {
      message: 'Mức lương tối thiểu không được lớn hơn mức lương tối đa',
      path: ['salaryMax'],
    },
  );

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

  @ApiPropertyOptional({
    description: 'Bật/Tắt trạng thái public hồ sơ',
    example: true,
  })
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Link Hồ sơ LinkedIn',
    example: 'https://linkedin.com/in/username',
  })
  linkedinUrl?: string;

  @ApiPropertyOptional({
    description: 'Link Hồ sơ Github',
    example: 'https://github.com/username',
  })
  githubUrl?: string;

  @ApiPropertyOptional({
    description: 'Link Hồ sơ Cá nhân / Portfolio',
    example: 'https://myportfolio.com',
  })
  portfolioUrl?: string;
}
