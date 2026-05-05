import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuditLogAction } from '../entities/audit-log.entity';

const AdminAuditLogFilterSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  action: z.nativeEnum(AuditLogAction).optional(),
  adminId: z.coerce.number().int().optional(),
  resource: z.string().optional(),
  resourceId: z.string().optional(),
});

export class AdminAuditLogFilterDto extends createZodDto(
  AdminAuditLogFilterSchema,
) {
  @ApiPropertyOptional({ default: 1 })
  page: number;

  @ApiPropertyOptional({ default: 20 })
  limit: number;

  @ApiPropertyOptional({ enum: AuditLogAction })
  action?: AuditLogAction;

  @ApiPropertyOptional()
  adminId?: number;

  @ApiPropertyOptional()
  resource?: string;

  @ApiPropertyOptional()
  resourceId?: string;
}
