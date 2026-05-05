import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '../../../users/entities/user.entity';

const AdminUserFilterSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  isEmailVerified: z.coerce.boolean().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['created_at']).optional().default('created_at'),
  order: z.enum(['ASC', 'DESC']).optional().default('DESC'),
});

export class AdminUserFilterDto extends createZodDto(AdminUserFilterSchema) {
  @ApiPropertyOptional({ default: 1 })
  page: number;

  @ApiPropertyOptional({ default: 20 })
  limit: number;

  @ApiPropertyOptional({ enum: UserRole })
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus })
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'true | false' })
  isEmailVerified?: boolean;

  @ApiPropertyOptional({ description: 'Tìm theo email' })
  search?: string;

  @ApiPropertyOptional({ enum: ['created_at'], default: 'created_at' })
  sortBy: 'created_at';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  order: 'ASC' | 'DESC';
}
