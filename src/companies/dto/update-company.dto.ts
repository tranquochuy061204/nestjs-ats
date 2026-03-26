import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const UpdateCompanySchema = z.object({
  categoryId: z.number().int().optional(),
  name: z.string().optional(),
  emailContact: z
    .email('Email liên hệ không hợp lệ')
    .optional()
    .or(z.literal('')),
  phoneContact: z.string().optional(),
  address: z.string().optional(),
  provinceId: z.number().int().optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  companySize: z.string().optional(),
  websiteUrl: z.url('URL không hợp lệ').optional().or(z.literal('')),
  facebookUrl: z.url('URL không hợp lệ').optional().or(z.literal('')),
  linkedinUrl: z.url('URL không hợp lệ').optional().or(z.literal('')),
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
