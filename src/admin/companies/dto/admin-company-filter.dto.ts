import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyStatus } from '../../../companies/entities/company.entity';

const AdminCompanyFilterSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.nativeEnum(CompanyStatus).optional(),
  hasVip: z.coerce.boolean().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'name', 'verifiedAt']).optional().default('createdAt'),
  order: z.enum(['ASC', 'DESC']).optional().default('DESC'),
});

export class AdminCompanyFilterDto extends createZodDto(AdminCompanyFilterSchema) {
  @ApiPropertyOptional({ default: 1 })
  page: number;

  @ApiPropertyOptional({ default: 20 })
  limit: number;

  @ApiPropertyOptional({ enum: CompanyStatus })
  status?: CompanyStatus;

  @ApiPropertyOptional({ description: 'true = chỉ lấy company có VIP active' })
  hasVip?: boolean;

  @ApiPropertyOptional({ description: 'Tìm theo tên hoặc email' })
  search?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'name', 'verifiedAt'],
    default: 'createdAt',
  })
  sortBy: 'createdAt' | 'name' | 'verifiedAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  order: 'ASC' | 'DESC';
}
