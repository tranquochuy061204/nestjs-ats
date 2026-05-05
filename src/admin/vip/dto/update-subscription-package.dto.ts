import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const UpdateSubscriptionPackageSchema = z.object({
  displayName: z.string().optional(),
  price: z.coerce.number().min(0).optional(),
  durationDays: z.coerce.number().int().optional(),
  
  maxActiveJobs: z.coerce.number().int().optional(),
  jobDurationDays: z.coerce.number().int().optional(),
  maxProfileViewsPerJob: z.coerce.number().int().optional(),
  dailyApplicationProcessLimit: z.coerce.number().int().optional(),
  bumpPostQuota: z.coerce.number().int().min(0).optional(),
  maxScreeningQuestions: z.coerce.number().int().min(0).optional(),
  monthlyHeadhuntProfileViews: z.coerce.number().int().optional(),
  monthlyFreeProceeds: z.coerce.number().int().min(0).optional(),

  canHeadhuntSaveAndInvite: z.coerce.boolean().optional(),
  canHideSalary: z.coerce.boolean().optional(),
  canRequireCv: z.coerce.boolean().optional(),
  hasVipBadge: z.coerce.boolean().optional(),
  freeContactUnlock: z.coerce.boolean().optional(),
  freeAiScoring: z.coerce.boolean().optional(),
  canUsePremiumFilters: z.coerce.boolean().optional(),
});

export class UpdateSubscriptionPackageDto extends createZodDto(UpdateSubscriptionPackageSchema) {
  @ApiPropertyOptional({ description: 'Tên hiển thị của gói' })
  displayName?: string;

  @ApiPropertyOptional({ description: 'Giá (VNĐ)' })
  price?: number;

  @ApiPropertyOptional({ description: 'Số ngày hiệu lực (30 | 90 | ...)' })
  durationDays?: number;

  // ── Quotas ───────────────────────────────────────────────

  @ApiPropertyOptional({ description: '-1 = unlimited' })
  maxActiveJobs?: number;

  @ApiPropertyOptional()
  jobDurationDays?: number;

  @ApiPropertyOptional({ description: '-1 = unlimited' })
  maxProfileViewsPerJob?: number;

  @ApiPropertyOptional({ description: '-1 = unlimited' })
  dailyApplicationProcessLimit?: number;

  @ApiPropertyOptional()
  bumpPostQuota?: number;

  @ApiPropertyOptional()
  maxScreeningQuestions?: number;

  @ApiPropertyOptional({ description: '-1 = unlimited' })
  monthlyHeadhuntProfileViews?: number;

  @ApiPropertyOptional()
  monthlyFreeProceeds?: number;

  // ── Feature Toggles ──────────────────────────────────────

  @ApiPropertyOptional()
  canHeadhuntSaveAndInvite?: boolean;

  @ApiPropertyOptional()
  canHideSalary?: boolean;

  @ApiPropertyOptional()
  canRequireCv?: boolean;

  @ApiPropertyOptional()
  hasVipBadge?: boolean;

  @ApiPropertyOptional()
  freeContactUnlock?: boolean;

  @ApiPropertyOptional()
  freeAiScoring?: boolean;

  @ApiPropertyOptional()
  canUsePremiumFilters?: boolean;
}
