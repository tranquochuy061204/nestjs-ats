import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SetupCompanySchema = z.object({
  fullName: z.string().min(1, 'Họ và tên không được để trống').max(100),
  phoneContact: z.string().min(1, 'Số điện thoại không được để trống').max(20),
  companyName: z.string().min(1, 'Tên công ty không được để trống').max(255),
  categoryId: z.number().int().positive(),
  provinceId: z.number().int().positive().optional(),
  address: z.string().max(500, 'Địa chỉ quá dài').optional(),
});

export class SetupCompanyDto extends createZodDto(SetupCompanySchema) {
  @ApiProperty({ description: 'Họ và tên HR' })
  fullName: string;

  @ApiProperty({ description: 'Số điện thoại cá nhân HR' })
  phoneContact: string;

  @ApiProperty({ description: 'Tên Công ty' })
  companyName: string;

  @ApiProperty({ description: 'ID Ngành nghề / Lĩnh vực công ty' })
  categoryId: number;

  @ApiPropertyOptional({ description: 'ID Tỉnh / Thành phố trụ sở' })
  provinceId?: number;

  @ApiPropertyOptional({ description: 'Địa chỉ cụ thể' })
  address?: string;
}
