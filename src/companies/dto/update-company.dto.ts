import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const UpdateCompanySchema = z.object({
  categoryId: z.number().int().optional(),
  name: z.string().max(255, 'Tên công ty quá dài').optional(),
  emailContact: z
    .string()
    .email('Email liên hệ không hợp lệ')
    .max(255)
    .optional()
    .or(z.literal('')),
  phoneContact: z.string().max(20, 'Số điện thoại quá dài').optional(),
  address: z.string().max(500, 'Địa chỉ quá dài').optional(),
  provinceId: z.number().int().optional(),
  description: z.string().max(2000, 'Mô tả quá dài').optional(),
  content: z.string().max(10000, 'Nội dung giới thiệu quá dài').optional(),
  companySize: z.string().max(50, 'Quy mô công ty không hợp lệ').optional(),
  websiteUrl: z.url('URL không hợp lệ').max(255).optional().or(z.literal('')),
  facebookUrl: z.url('URL không hợp lệ').max(255).optional().or(z.literal('')),
  linkedinUrl: z.url('URL không hợp lệ').max(255).optional().or(z.literal('')),
});

export class UpdateCompanyDto extends createZodDto(UpdateCompanySchema) {
  @ApiPropertyOptional()
  categoryId?: number;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  emailContact?: string;

  @ApiPropertyOptional()
  phoneContact?: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional()
  provinceId?: number;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  content?: string;

  @ApiPropertyOptional()
  companySize?: string;

  @ApiPropertyOptional()
  websiteUrl?: string;

  @ApiPropertyOptional()
  facebookUrl?: string;

  @ApiPropertyOptional()
  linkedinUrl?: string;
}
