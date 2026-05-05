import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const AdminPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export class AdminPaginationDto extends createZodDto(AdminPaginationSchema) {
  @ApiPropertyOptional({ default: 1 })
  page: number;

  @ApiPropertyOptional({ default: 20 })
  limit: number;

  /** Dùng nội bộ để tính OFFSET */
  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 20);
  }
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
) {
  return {
    total,
    page,
    limit,
    lastPage: Math.ceil(total / limit),
  };
}
